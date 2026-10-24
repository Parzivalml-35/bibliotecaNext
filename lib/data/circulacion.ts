import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { PrestamoAbierto } from "@/lib/definitions";

// SQL de préstamos, devoluciones y reservas físicas. Las funciones que reciben `conexion` se usan DENTRO
// de una transacción (enTransaccion en lib/db.ts); las reglas que las combinan están en
// lib/actions/circulacion.ts. FOR UPDATE bloquea las filas leídas hasta el COMMIT: otra transacción que
// quiera las mismas filas espera, así dos empleados no prestan el mismo ejemplar a la vez.

type Conexion = PoolConnection;

export type EstadoEjemplar =
  | "disponible" | "apartado" | "prestado" | "por_ubicar" | "en_transito" | "en_reparacion" | "perdido" | "de_baja";

// ---------------------------------------------------------------------
// Ejemplar
// ---------------------------------------------------------------------

type FilaEjemplar = {
  id_ejemplar: number;
  codigo_barras: string;
  id_libro: number;
  titulo: string;
  id_sede: number;
  sede: string;
  id_ubicacion: number | null;
  ubicacion: string | null; // "A-1-2" (pasillo-estante-nivel)
  estado: EstadoEjemplar;
  edad_minima: number; // RN-46
  clasificacion: string;
} & RowDataPacket;

// FOR UPDATE OF e: bloquea solo la fila del ejemplar, no las del libro ni la sede del JOIN.
// `columna` elige entre dos fragmentos fijos escritos aquí; el valor buscado siempre va como parámetro.
async function bloquearEjemplar(conexion: Conexion, columna: "e.codigo_barras" | "e.id_ejemplar", valor: string | number) {
  const [filas] = await conexion.execute<FilaEjemplar[]>(
    `SELECT e.id_ejemplar, e.codigo_barras, e.id_libro, l.titulo, e.id_sede, sd.nombre AS sede,
            e.id_ubicacion, CONCAT(u.pasillo, '-', u.estante, '-', u.nivel) AS ubicacion, e.estado,
            ce.edad_minima, ce.nombre AS clasificacion
     FROM ejemplar e
     JOIN libro l ON l.id_libro = e.id_libro
     JOIN clasificacion_edad ce ON ce.id_clasificacion = l.id_clasificacion
     JOIN sede sd ON sd.id_sede = e.id_sede
     LEFT JOIN ubicacion u ON u.id_ubicacion = e.id_ubicacion
     WHERE ${columna} = ?
     FOR UPDATE OF e`,
    [valor],
  );
  return filas[0] ?? null;
}

export function bloquearEjemplarPorCodigo(conexion: Conexion, codigo: string) {
  return bloquearEjemplar(conexion, "e.codigo_barras", codigo);
}

export function bloquearEjemplarPorId(conexion: Conexion, idEjemplar: number) {
  return bloquearEjemplar(conexion, "e.id_ejemplar", idEjemplar);
}

// RN-23: el candado optimista. Solo cambia si el estado sigue siendo el esperado; si otra operación lo
// cambió antes, affectedRows es 0 y quien llama debe abortar. También mueve de sede (RN-13).
export async function cambiarEstadoEjemplar(
  conexion: Conexion,
  idEjemplar: number,
  estadoEsperado: EstadoEjemplar,
  nuevo: { estado: EstadoEjemplar; idSede: number; idUbicacion: number | null },
): Promise<boolean> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    "UPDATE ejemplar SET estado = ?, id_sede = ?, id_ubicacion = ? WHERE id_ejemplar = ? AND estado = ?",
    [nuevo.estado, nuevo.idSede, nuevo.idUbicacion, idEjemplar, estadoEsperado],
  );
  return resultado.affectedRows === 1;
}

// ---------------------------------------------------------------------
// Lector
// ---------------------------------------------------------------------

type FilaLector = {
  id_lector: number;
  nombre: string; // "Ana Ruiz"
  validado: number; // D-03
  desactivada: number; // RN-01
  edad: number; // RN-46, calculada
  max_prestamos_fisicos: number; // RN-02
  dias_prestamo_fisico: number;
} & RowDataPacket;

// FOR UPDATE OF l serializa las operaciones del MISMO lector: una segunda transacción que quiera prestarle
// espera aquí hasta el COMMIT de la primera. Primero bloquear, después contar (situacionDelLector).
export async function bloquearLectorPorDocumento(conexion: Conexion, tipoDocumento: string, numeroDocumento: string) {
  const [filas] = await conexion.execute<FilaLector[]>(
    `SELECT l.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS nombre,
            l.fecha_validacion IS NOT NULL AS validado, c.fecha_desactivacion IS NOT NULL AS desactivada,
            TIMESTAMPDIFF(YEAR, l.fecha_nacimiento, CURDATE()) AS edad,
            t.max_prestamos_fisicos, t.dias_prestamo_fisico
     FROM lector l
     JOIN cuenta c ON c.id_cuenta = l.id_cuenta
     JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
     WHERE l.tipo_documento = ? AND l.numero_documento = ?
     FOR UPDATE OF l`,
    [tipoDocumento, numeroDocumento],
  );
  return filas[0] ?? null;
}

type FilaLectorDeCuenta = {
  id_lector: number;
  nombre: string;
  verificada: number; // RN-32, RN-72: para reservar basta la cuenta verificada
  edad: number;
  max_reservas_fisicas: number;
  dias_recoger_reserva: number;
} & RowDataPacket;

// Igual que bloquearLectorPorDocumento, pero desde la sesión del propio lector (reservas en la web).
export async function bloquearLectorPorCuenta(conexion: Conexion, idCuenta: number) {
  const [filas] = await conexion.execute<FilaLectorDeCuenta[]>(
    `SELECT l.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS nombre, c.fecha_verificacion IS NOT NULL AS verificada,
            TIMESTAMPDIFF(YEAR, l.fecha_nacimiento, CURDATE()) AS edad, t.max_reservas_fisicas, t.dias_recoger_reserva
     FROM lector l
     JOIN cuenta c ON c.id_cuenta = l.id_cuenta
     JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
     WHERE l.id_cuenta = ? AND c.fecha_desactivacion IS NULL
     FOR UPDATE OF l`,
    [idCuenta],
  );
  return filas[0] ?? null;
}

type FilaPrestamosDelLector = { abiertos: number; vencidos: number } & RowDataPacket;
type FilaMultasDelLector = { pendientes: number } & RowDataPacket;
type FilaReservasDelLector = { vivas: number } & RowDataPacket;

// RN-02, RN-03 (db/consultas.sql, consulta 4). Se cuenta con LECTURAS CON BLOQUEO (FOR SHARE), no con
// subconsultas normales: en REPEATABLE READ una lectura normal ve la "foto" que la transacción tomó en su
// primera lectura, y no vería el préstamo que otra transacción confirmó mientras esta esperaba el
// candado del lector. Una lectura con bloqueo siempre lee la última versión confirmada.
// (Verificado: con subconsultas, dos préstamos simultáneos dejaron a un lector con 3 de 2.)
export async function situacionDelLector(conexion: Conexion, idLector: number) {
  const [prestamos] = await conexion.execute<FilaPrestamosDelLector[]>(
    // RN-71: el préstamo de un ejemplar declarado perdido ya no cuenta (lo que bloquea es su multa).
    `SELECT COUNT(*) AS abiertos, COALESCE(SUM(p.fecha_vencimiento < CURDATE()), 0) AS vencidos
     FROM prestamo_fisico p JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     WHERE p.id_lector = ? AND p.fecha_devolucion IS NULL AND e.estado <> 'perdido'
     FOR SHARE`,
    [idLector],
  );
  const [multas] = await conexion.execute<FilaMultasDelLector[]>(
    `SELECT COUNT(*) AS pendientes
     FROM multa m JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
     WHERE p.id_lector = ? AND m.estado = 'pendiente'
     FOR SHARE`,
    [idLector],
  );
  // RN-12, RN-45: reservas físicas vivas (en cola o asignadas).
  const [reservas] = await conexion.execute<FilaReservasDelLector[]>(
    "SELECT COUNT(*) AS vivas FROM reserva_fisica WHERE id_lector = ? AND estado IN ('activa', 'asignada') FOR SHARE",
    [idLector],
  );
  return {
    reservasVivas: Number(reservas[0].vivas),
    abiertos: Number(prestamos[0].abiertos),
    vencidos: Number(prestamos[0].vencidos), // SUM devuelve DECIMAL: Number() lo deja en número
    multasPendientes: Number(multas[0].pendientes),
  };
}

// ---------------------------------------------------------------------
// Reservas físicas (RN-09 a RN-11, RN-48)
// ---------------------------------------------------------------------

type FilaReservaVencida = { id_reserva: number; id_ejemplar: number } & RowDataPacket;

// RN-48: reservas asignadas de una obra en una sede cuyo plazo de recogida ya pasó.
export async function bloquearReservasVencidas(conexion: Conexion, idLibro: number, idSede: number) {
  const [filas] = await conexion.execute<FilaReservaVencida[]>(
    `SELECT id_reserva, id_ejemplar FROM reserva_fisica
     WHERE id_libro = ? AND id_sede = ? AND estado = 'asignada' AND fecha_limite_recogida < NOW()
     FOR UPDATE`,
    [idLibro, idSede],
  );
  return filas;
}

export async function marcarReservaVencida(conexion: Conexion, idReserva: number): Promise<void> {
  await conexion.execute(
    "UPDATE reserva_fisica SET estado = 'vencida', fecha_cierre = NOW() WHERE id_reserva = ? AND estado = 'asignada'",
    [idReserva],
  );
}

type FilaPrimeraEnCola = {
  id_reserva: number;
  id_lector: number;
  lector: string;
  dias_recoger_reserva: number; // RN-12: del tipo de lector de quien reservó
} & RowDataPacket;

// RN-09, RN-11: la primera de la cola por orden de llegada (desempate por id: orden total).
export async function bloquearPrimeraEnCola(conexion: Conexion, idLibro: number, idSede: number) {
  const [filas] = await conexion.execute<FilaPrimeraEnCola[]>(
    `SELECT r.id_reserva, r.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS lector, t.dias_recoger_reserva
     FROM reserva_fisica r
     JOIN lector l ON l.id_lector = r.id_lector
     JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
     WHERE r.id_libro = ? AND r.id_sede = ? AND r.estado = 'activa'
     ORDER BY r.fecha_solicitud, r.id_reserva
     LIMIT 1
     FOR UPDATE OF r`,
    [idLibro, idSede],
  );
  return filas[0] ?? null;
}

export async function asignarReserva(conexion: Conexion, idReserva: number, idEjemplar: number, diasParaRecoger: number) {
  await conexion.execute(
    `UPDATE reserva_fisica
     SET estado = 'asignada', id_ejemplar = ?, fecha_asignacion = NOW(), fecha_limite_recogida = NOW() + INTERVAL ? DAY
     WHERE id_reserva = ? AND estado = 'activa'`,
    [idEjemplar, diasParaRecoger, idReserva],
  );
}

type FilaReservaDelEjemplar = { id_reserva: number; id_lector: number; lector: string } & RowDataPacket;

// La reserva para la que está apartado un ejemplar (RN-10).
export async function bloquearReservaAsignada(conexion: Conexion, idEjemplar: number) {
  const [filas] = await conexion.execute<FilaReservaDelEjemplar[]>(
    `SELECT r.id_reserva, r.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS lector
     FROM reserva_fisica r JOIN lector l ON l.id_lector = r.id_lector
     WHERE r.id_ejemplar = ? AND r.estado = 'asignada'
     FOR UPDATE OF r`,
    [idEjemplar],
  );
  return filas[0] ?? null;
}

// RN-10 (asignada que se recoge) y RN-69 (la primera de la cola se lleva una copia disponible en mostrador).
export async function cumplirReserva(conexion: Conexion, idReserva: number, idPrestamo: number, idEjemplar: number) {
  await conexion.execute(
    `UPDATE reserva_fisica SET estado = 'cumplida', id_prestamo = ?, id_ejemplar = COALESCE(id_ejemplar, ?), fecha_cierre = NOW()
     WHERE id_reserva = ? AND estado IN ('activa', 'asignada')`,
    [idPrestamo, idEjemplar, idReserva],
  );
}

type FilaReservaViva = {
  id_reserva: number;
  id_lector: number;
  id_libro: number;
  id_sede: number;
  estado: "activa" | "asignada";
  id_ejemplar: number | null;
} & RowDataPacket;

// RN-68: las reservas vivas de un lector por una obra (por la restricción uq_reserva_viva, como mucho una).
export async function bloquearReservasVivasDelLector(conexion: Conexion, idLector: number, idLibro: number) {
  const [filas] = await conexion.execute<FilaReservaViva[]>(
    `SELECT id_reserva, id_lector, id_libro, id_sede, estado, id_ejemplar FROM reserva_fisica
     WHERE id_lector = ? AND id_libro = ? AND estado IN ('activa', 'asignada')
     FOR UPDATE`,
    [idLector, idLibro],
  );
  return filas;
}

export async function bloquearReservaPorId(conexion: Conexion, idReserva: number) {
  const [filas] = await conexion.execute<FilaReservaViva[]>(
    "SELECT id_reserva, id_lector, id_libro, id_sede, estado, id_ejemplar FROM reserva_fisica WHERE id_reserva = ? FOR UPDATE",
    [idReserva],
  );
  return filas[0] ?? null;
}

export async function cancelarReserva(conexion: Conexion, idReserva: number) {
  await conexion.execute(
    "UPDATE reserva_fisica SET estado = 'cancelada', fecha_cierre = NOW() WHERE id_reserva = ? AND estado IN ('activa', 'asignada')",
    [idReserva],
  );
}

// RN-09: una copia disponible de la obra en la sede (la primera por id, bloqueada).
export async function bloquearCopiaDisponible(conexion: Conexion, idLibro: number, idSede: number) {
  const [filas] = await conexion.execute<({ id_ejemplar: number; id_ubicacion: number | null } & RowDataPacket)[]>(
    `SELECT id_ejemplar, id_ubicacion FROM ejemplar WHERE id_libro = ? AND id_sede = ? AND estado = 'disponible'
     ORDER BY id_ejemplar LIMIT 1 FOR UPDATE`,
    [idLibro, idSede],
  );
  return filas[0] ?? null;
}

// RN-68, RN-75: no se reserva ni se presta otra vez una obra que el lector ya tiene prestada.
export async function tienePrestadaLaObra(conexion: Conexion, idLector: number, idLibro: number): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>(
    `SELECT 1 FROM prestamo_fisico p JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     WHERE p.id_lector = ? AND e.id_libro = ? AND p.fecha_devolucion IS NULL AND e.estado <> 'perdido'
     LIMIT 1 FOR SHARE`,
    [idLector, idLibro],
  );
  return filas.length > 0;
}

// Reserva nueva: en cola (activa) o asignada de inmediato si hay copia (RN-09). Devuelve el id.
export async function insertarReserva(
  conexion: Conexion,
  datos: { idLector: number; idLibro: number; idSede: number; idEjemplar: number | null; diasParaRecoger: number },
): Promise<number> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    datos.idEjemplar === null
      ? "INSERT INTO reserva_fisica (id_lector, id_libro, id_sede) VALUES (?, ?, ?)"
      : `INSERT INTO reserva_fisica (id_lector, id_libro, id_sede, estado, id_ejemplar, fecha_asignacion, fecha_limite_recogida)
         VALUES (?, ?, ?, 'asignada', ?, NOW(), NOW() + INTERVAL ? DAY)`,
    datos.idEjemplar === null
      ? [datos.idLector, datos.idLibro, datos.idSede]
      : [datos.idLector, datos.idLibro, datos.idSede, datos.idEjemplar, datos.diasParaRecoger],
  );
  return resultado.insertId;
}

// Posición en la cola de una reserva activa (db/consultas.sql, consulta 6).
export async function posicionEnCola(conexion: Conexion, idReserva: number): Promise<number> {
  const [filas] = await conexion.execute<({ posicion: number } & RowDataPacket)[]>(
    `SELECT COUNT(*) AS posicion FROM reserva_fisica r
     JOIN reserva_fisica mia ON mia.id_reserva = ?
     WHERE r.id_libro = mia.id_libro AND r.id_sede = mia.id_sede AND r.estado = 'activa'
       AND (r.fecha_solicitud, r.id_reserva) <= (mia.fecha_solicitud, mia.id_reserva)`,
    [idReserva],
  );
  return Number(filas[0].posicion);
}

// RN-04: ¿alguien espera esta obra? Solo cuentan las reservas en cola (activa), en cualquier sede.
// FOR SHARE por lo mismo que situacionDelLector: leer lo último confirmado, no la foto de la transacción.
export async function hayReservaEnCola(conexion: Conexion, idLibro: number): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>(
    "SELECT 1 FROM reserva_fisica WHERE id_libro = ? AND estado = 'activa' LIMIT 1 FOR SHARE",
    [idLibro],
  );
  return filas.length > 0;
}

// ---------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------

// fecha_vencimiento se calcula en MySQL (CURDATE() + días del tipo de lector, RN-02) y se devuelve como texto.
export async function insertarPrestamo(
  conexion: Conexion,
  datos: { idEjemplar: number; idLector: number; idSede: number; idEmpleado: number; dias: number },
): Promise<{ idPrestamo: number; vence: string }> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    `INSERT INTO prestamo_fisico (id_ejemplar, id_lector, id_sede_prestamo, id_empleado_presta, fecha_vencimiento)
     VALUES (?, ?, ?, ?, CURDATE() + INTERVAL ? DAY)`,
    [datos.idEjemplar, datos.idLector, datos.idSede, datos.idEmpleado, datos.dias],
  );
  const [filas] = await conexion.execute<({ vence: string } & RowDataPacket)[]>(
    "SELECT DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS vence FROM prestamo_fisico WHERE id_prestamo = ?",
    [resultado.insertId],
  );
  return { idPrestamo: resultado.insertId, vence: filas[0].vence };
}

type FilaPrestamoParaDevolver = {
  id_prestamo: number;
  lector: string;
  dias_atraso: number; // 0 si se devuelve a tiempo
} & RowDataPacket;

export async function bloquearPrestamoAbiertoDelEjemplar(conexion: Conexion, idEjemplar: number) {
  const [filas] = await conexion.execute<FilaPrestamoParaDevolver[]>(
    `SELECT p.id_prestamo, CONCAT(l.nombre, ' ', l.apellido) AS lector,
            GREATEST(DATEDIFF(CURDATE(), p.fecha_vencimiento), 0) AS dias_atraso
     FROM prestamo_fisico p JOIN lector l ON l.id_lector = p.id_lector
     WHERE p.id_ejemplar = ? AND p.fecha_devolucion IS NULL
     FOR UPDATE OF p`,
    [idEjemplar],
  );
  return filas[0] ?? null;
}

// RN-13: la sede de devolución es la del empleado que recibe, que puede no ser la del préstamo.
export async function registrarDevolucion(conexion: Conexion, idPrestamo: number, idSede: number, idEmpleado: number) {
  await conexion.execute(
    `UPDATE prestamo_fisico SET fecha_devolucion = NOW(), id_sede_devolucion = ?, id_empleado_recibe = ?
     WHERE id_prestamo = ? AND fecha_devolucion IS NULL`,
    [idSede, idEmpleado, idPrestamo],
  );
}

// RN-05: días × valor por día, con tope; ambos valores en configuracion (C-04). Devuelve el monto.
export async function insertarMultaPorRetraso(conexion: Conexion, idPrestamo: number, diasAtraso: number): Promise<number> {
  await conexion.execute(
    `INSERT INTO multa (id_prestamo, tipo, monto)
     SELECT ?, 'retraso', LEAST(? * multa_por_dia, multa_tope) FROM configuracion`,
    [idPrestamo, diasAtraso],
  );
  const [filas] = await conexion.execute<({ monto: number } & RowDataPacket)[]>(
    "SELECT monto FROM multa WHERE id_prestamo = ? AND tipo = 'retraso'",
    [idPrestamo],
  );
  return filas[0].monto;
}

type FilaPrestamoParaRenovar = {
  id_prestamo: number;
  id_libro: number;
  id_sede_prestamo: number;
  renovaciones: number;
  max_renovaciones: number; // RN-04, configuracion
  vencido: number;
  devuelto: number;
  dias_prestamo_fisico: number;
} & RowDataPacket;

export async function bloquearPrestamoParaRenovar(conexion: Conexion, idPrestamo: number) {
  const [filas] = await conexion.execute<FilaPrestamoParaRenovar[]>(
    `SELECT p.id_prestamo, e.id_libro, p.id_sede_prestamo, p.renovaciones, cf.max_renovaciones,
            p.fecha_vencimiento < CURDATE() AS vencido, p.fecha_devolucion IS NOT NULL AS devuelto,
            t.dias_prestamo_fisico
     FROM prestamo_fisico p
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN lector l ON l.id_lector = p.id_lector
     JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
     CROSS JOIN configuracion cf
     WHERE p.id_prestamo = ?
     FOR UPDATE OF p`,
    [idPrestamo],
  );
  return filas[0] ?? null;
}

// RN-65: el plazo nuevo se cuenta desde el vencimiento actual. Devuelve la fecha nueva como texto.
export async function extenderPrestamo(conexion: Conexion, idPrestamo: number, dias: number): Promise<string> {
  await conexion.execute(
    `UPDATE prestamo_fisico SET fecha_vencimiento = fecha_vencimiento + INTERVAL ? DAY, renovaciones = renovaciones + 1
     WHERE id_prestamo = ?`,
    [dias, idPrestamo],
  );
  const [filas] = await conexion.execute<({ vence: string } & RowDataPacket)[]>(
    "SELECT DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS vence FROM prestamo_fisico WHERE id_prestamo = ?",
    [idPrestamo],
  );
  return filas[0].vence;
}

// ---------------------------------------------------------------------
// Lecturas para el panel (sin transacción)
// ---------------------------------------------------------------------

type FilaPrestamoAbierto = PrestamoAbierto & RowDataPacket;

// db/consultas.sql, consulta 5. Con idSede, solo los prestados en esa sede (RN-34); null = toda la red.
// Se arma con fragmentos fijos: el valor de la sede siempre va como parámetro.
export async function obtenerPrestamosAbiertos(idSede: number | null): Promise<PrestamoAbierto[]> {
  const filtroSede = idSede === null ? "" : "AND p.id_sede_prestamo = ?";
  const [filas] = await pool.execute<FilaPrestamoAbierto[]>(
    `SELECT p.id_prestamo, e.codigo_barras, l.titulo, CONCAT(lc.nombre, ' ', lc.apellido) AS lector,
            sd.nombre AS sede, DATE_FORMAT(p.fecha_prestamo, '%Y-%m-%d') AS fecha_prestamo,
            DATE_FORMAT(p.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento, p.renovaciones,
            GREATEST(DATEDIFF(CURDATE(), p.fecha_vencimiento), 0) AS dias_atraso
     FROM prestamo_fisico p
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN libro l ON l.id_libro = e.id_libro
     JOIN lector lc ON lc.id_lector = p.id_lector
     JOIN sede sd ON sd.id_sede = p.id_sede_prestamo
     WHERE p.fecha_devolucion IS NULL AND e.estado <> 'perdido' ${filtroSede}
     ORDER BY p.fecha_vencimiento, p.id_prestamo`,
    idSede === null ? [] : [idSede],
  );
  return filas;
}

// ---------------------------------------------------------------------
// Ubicar ejemplares (RN-17, RN-20)
// ---------------------------------------------------------------------

export type EjemplarPorUbicar = {
  id_ejemplar: number;
  codigo_barras: string;
  titulo: string;
  seccion: string;
  color_hex: string;
  id_ubicacion_sugerida: number | null;
};

// RN-20: los ejemplares por ubicar de una sede, con un estante SUGERIDO: el de la sección de su género
// principal que menos ejemplares tiene en esa sede (reparte la carga entre estantes).
export async function obtenerPorUbicar(idSede: number): Promise<EjemplarPorUbicar[]> {
  const [filas] = await pool.execute<(EjemplarPorUbicar & RowDataPacket)[]>(
    `SELECT e.id_ejemplar, e.codigo_barras, l.titulo, sc.nombre AS seccion, sc.color_hex,
            (SELECT u.id_ubicacion FROM ubicacion u
             LEFT JOIN ejemplar x ON x.id_ubicacion = u.id_ubicacion
             WHERE u.id_sede = e.id_sede AND u.id_seccion = g.id_seccion
             GROUP BY u.id_ubicacion
             ORDER BY COUNT(x.id_ejemplar), u.pasillo, u.estante, u.nivel
             LIMIT 1) AS id_ubicacion_sugerida
     FROM ejemplar e
     JOIN libro l ON l.id_libro = e.id_libro
     JOIN genero g ON g.id_genero = l.id_genero_principal
     JOIN seccion sc ON sc.id_seccion = g.id_seccion
     WHERE e.id_sede = ? AND e.estado = 'por_ubicar'
     ORDER BY l.titulo, e.codigo_barras`,
    [idSede],
  );
  return filas;
}

export type UbicacionDeSede = { id_ubicacion: number; etiqueta: string; seccion: string };

// El catálogo de ubicaciones válidas de una sede (RN-17): de aquí sale el <select>, nunca texto libre.
export async function obtenerUbicacionesDeSede(idSede: number): Promise<UbicacionDeSede[]> {
  const [filas] = await pool.execute<(UbicacionDeSede & RowDataPacket)[]>(
    `SELECT u.id_ubicacion, CONCAT(u.pasillo, '-', u.estante, '-', u.nivel) AS etiqueta, sc.nombre AS seccion
     FROM ubicacion u JOIN seccion sc ON sc.id_seccion = u.id_seccion
     WHERE u.id_sede = ? ORDER BY u.pasillo, u.estante, u.nivel`,
    [idSede],
  );
  return filas;
}

// La ubicación debe ser de la sede del empleado (la FK compuesta de ejemplar también lo exige).
export async function ubicacionEsDeSede(conexion: Conexion, idUbicacion: number, idSede: number) {
  const [filas] = await conexion.execute<({ etiqueta: string } & RowDataPacket)[]>(
    "SELECT CONCAT(pasillo, '-', estante, '-', nivel) AS etiqueta FROM ubicacion WHERE id_ubicacion = ? AND id_sede = ?",
    [idUbicacion, idSede],
  );
  return filas[0]?.etiqueta ?? null;
}

// ---------------------------------------------------------------------
// Ejemplares perdidos (RN-06, RN-49, RN-71)
// ---------------------------------------------------------------------

export type CandidatoAPerdido = {
  id_prestamo: number;
  codigo_barras: string;
  titulo: string;
  lector: string;
  dias_atraso: number;
  valor_reposicion: number;
};

// db/consultas.sql, consulta 8, por sede del préstamo: más de dias_atraso_perdido días de atraso.
export async function obtenerCandidatosAPerdido(idSede: number): Promise<CandidatoAPerdido[]> {
  const [filas] = await pool.execute<(CandidatoAPerdido & RowDataPacket)[]>(
    `SELECT p.id_prestamo, e.codigo_barras, l.titulo, CONCAT(lc.nombre, ' ', lc.apellido) AS lector,
            DATEDIFF(CURDATE(), p.fecha_vencimiento) AS dias_atraso, e.valor_reposicion
     FROM prestamo_fisico p
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN libro l ON l.id_libro = e.id_libro
     JOIN lector lc ON lc.id_lector = p.id_lector
     CROSS JOIN configuracion cf
     WHERE p.fecha_devolucion IS NULL AND e.estado = 'prestado' AND p.id_sede_prestamo = ?
       AND DATEDIFF(CURDATE(), p.fecha_vencimiento) > cf.dias_atraso_perdido
     ORDER BY dias_atraso DESC`,
    [idSede],
  );
  return filas;
}

type FilaPrestamoParaPerdido = {
  id_prestamo: number;
  id_ejemplar: number;
  id_sede_prestamo: number;
  codigo_barras: string;
  titulo: string;
  lector: string;
  valor_reposicion: number;
  dias_atraso: number;
  dias_atraso_perdido: number;
} & RowDataPacket;

export async function bloquearPrestamoParaPerdido(conexion: Conexion, idPrestamo: number) {
  const [filas] = await conexion.execute<FilaPrestamoParaPerdido[]>(
    `SELECT p.id_prestamo, p.id_ejemplar, p.id_sede_prestamo, e.codigo_barras, l.titulo,
            CONCAT(lc.nombre, ' ', lc.apellido) AS lector, e.valor_reposicion,
            DATEDIFF(CURDATE(), p.fecha_vencimiento) AS dias_atraso, cf.dias_atraso_perdido
     FROM prestamo_fisico p
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN libro l ON l.id_libro = e.id_libro
     JOIN lector lc ON lc.id_lector = p.id_lector
     CROSS JOIN configuracion cf
     WHERE p.id_prestamo = ? AND p.fecha_devolucion IS NULL
     FOR UPDATE OF p, e`,
    [idPrestamo],
  );
  return filas[0] ?? null;
}

// RN-06: la multa de reposición es el valor de reposición del ejemplar.
export async function insertarMultaReposicion(conexion: Conexion, idPrestamo: number, monto: number) {
  await conexion.execute("INSERT INTO multa (id_prestamo, tipo, monto) VALUES (?, 'reposicion', ?)", [idPrestamo, monto]);
}
