import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

// SQL del préstamo digital (RN-25 a RN-30, RN-44, RN-54 a RN-56). Las funciones con `conexion` van dentro
// de una transacción; las reglas que las combinan están en lib/actions/digital.ts.
//
// Orden de bloqueo fijo en todo el módulo: lector → lotes del título → reservas digitales del título.
// Bloquear los LOTES de un título serializa todas las operaciones digitales de ese título (RN-56): dos
// lectores que piden la última licencia esperan en fila, y el segundo cuenta después del COMMIT del primero.
//
// Vigencia: un lote con fecha_vencimiento = '2026-12-31' deja de contar al empezar ese día
// (TIMESTAMP(fecha) = 2026-12-31 00:00:00). Un préstamo es vigente si no se devolvió y fecha_fin > NOW() (RN-27).

type Conexion = PoolConnection;

// ---------------------------------------------------------------------
// Lector
// ---------------------------------------------------------------------

type FilaLectorDigital = {
  id_lector: number;
  nombre: string;
  correo: string;
  verificada: number;
  edad: number;
  max_prestamos_digitales: number;
  dias_prestamo_digital: number;
  max_reservas_digitales: number;
} & RowDataPacket;

export async function bloquearLectorDigital(conexion: Conexion, idCuenta: number) {
  const [filas] = await conexion.execute<FilaLectorDigital[]>(
    `SELECT l.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS nombre, c.correo,
            c.fecha_verificacion IS NOT NULL AS verificada, TIMESTAMPDIFF(YEAR, l.fecha_nacimiento, CURDATE()) AS edad,
            t.max_prestamos_digitales, t.dias_prestamo_digital, t.max_reservas_digitales
     FROM lector l
     JOIN cuenta c ON c.id_cuenta = l.id_cuenta
     JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
     WHERE l.id_cuenta = ? AND c.fecha_desactivacion IS NULL
     FOR UPDATE OF l`,
    [idCuenta],
  );
  return filas[0] ?? null;
}

// RN-26, RN-45: préstamos digitales vigentes y reservas digitales vivas del lector. FOR SHARE por la misma razón
// que situacionDelLector (lib/data/circulacion.ts): leer la última versión confirmada, no la "foto".
export async function situacionDigitalDelLector(conexion: Conexion, idLector: number) {
  const [prestamos] = await conexion.execute<({ vigentes: number } & RowDataPacket)[]>(
    `SELECT COUNT(*) AS vigentes FROM prestamo_digital
     WHERE id_lector = ? AND fecha_devolucion IS NULL AND fecha_fin > NOW() FOR SHARE`,
    [idLector],
  );
  const [reservas] = await conexion.execute<({ vivas: number } & RowDataPacket)[]>(
    "SELECT COUNT(*) AS vivas FROM reserva_digital WHERE id_lector = ? AND estado IN ('activa', 'asignada') FOR SHARE",
    [idLector],
  );
  return { prestamosVigentes: Number(prestamos[0].vigentes), reservasVivas: Number(reservas[0].vivas) };
}

// RN-29, RN-30: ¿ya puede leer el título? (préstamo vigente o compra). Bloquea para que dos clics no presten dos veces.
export async function bloquearAccesoAlTitulo(conexion: Conexion, idLector: number, idLibro: number) {
  const [filas] = await conexion.execute<({ prestamo: number; compra: number } & RowDataPacket)[]>(
    `SELECT
       (SELECT COUNT(*) FROM prestamo_digital p JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
        WHERE p.id_lector = ? AND ld.id_libro = ? AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW()
        FOR SHARE) AS prestamo,
       (SELECT COUNT(*) FROM acceso_digital WHERE id_lector = ? AND id_libro = ? FOR SHARE) AS compra`,
    [idLector, idLibro, idLector, idLibro],
  );
  return { prestamo: Number(filas[0].prestamo) > 0, compra: Number(filas[0].compra) > 0 };
}

// ---------------------------------------------------------------------
// Lotes de licencias (RN-25, RN-54 a RN-56)
// ---------------------------------------------------------------------

export type LoteConUso = {
  id_licencia: number;
  cantidad: number;
  // Segundos hasta que el lote vence (null = no vence). En segundos y calculado en MySQL para comparar con
  // "hoy + días" sin depender de la zona horaria de Node (RN-55).
  segundos_restantes: number | null;
  en_uso: number; // RN-56: préstamos vigentes + reservas asignadas dentro de su plazo
};

// Bloquea los lotes VIGENTES del título y cuenta su uso. Los conteos van DESPUÉS del FOR UPDATE y con FOR
// SHARE: así leen lo que confirmó quien tenía el candado antes (ver la nota de REPEATABLE READ arriba).
export async function bloquearLotesDelTitulo(conexion: Conexion, idLibro: number): Promise<LoteConUso[]> {
  const [lotes] = await conexion.execute<({ id_licencia: number; cantidad: number; segundos_restantes: number | null } & RowDataPacket)[]>(
    `SELECT id_licencia, cantidad, TIMESTAMPDIFF(SECOND, NOW(), TIMESTAMP(fecha_vencimiento)) AS segundos_restantes
     FROM licencia_digital
     WHERE id_libro = ? AND (fecha_vencimiento IS NULL OR TIMESTAMP(fecha_vencimiento) > NOW())
     ORDER BY id_licencia
     FOR UPDATE`,
    [idLibro],
  );
  if (lotes.length === 0) return [];
  const [uso] = await conexion.execute<({ id_licencia: number; en_uso: number } & RowDataPacket)[]>(
    `SELECT id_licencia, COUNT(*) AS en_uso FROM (
       SELECT id_licencia FROM prestamo_digital
       WHERE id_licencia IN (SELECT id_licencia FROM licencia_digital WHERE id_libro = ?)
         AND fecha_devolucion IS NULL AND fecha_fin > NOW()
       FOR SHARE
     ) p GROUP BY id_licencia
     UNION ALL
     SELECT id_licencia, COUNT(*) FROM (
       SELECT id_licencia FROM reserva_digital
       WHERE id_libro = ? AND estado = 'asignada' AND fecha_limite_confirmacion > NOW()
       FOR SHARE
     ) r GROUP BY id_licencia`,
    [idLibro, idLibro],
  );
  return lotes.map((l) => ({
    id_licencia: l.id_licencia,
    cantidad: l.cantidad,
    segundos_restantes: l.segundos_restantes === null ? null : Number(l.segundos_restantes),
    en_uso: uso.filter((u) => u.id_licencia === l.id_licencia).reduce((suma, u) => suma + Number(u.en_uso), 0),
  }));
}

// ---------------------------------------------------------------------
// Préstamos (RN-27, RN-44)
// ---------------------------------------------------------------------

// RN-44: fecha_fin = la menor entre hoy + días del tipo de lector y el vencimiento del lote. Se calcula en MySQL.
export async function insertarPrestamoDigital(conexion: Conexion, idLector: number, idLicencia: number, dias: number) {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    `INSERT INTO prestamo_digital (id_lector, id_licencia, fecha_fin)
     SELECT ?, id_licencia,
            IF(fecha_vencimiento IS NULL, NOW() + INTERVAL ? DAY, LEAST(NOW() + INTERVAL ? DAY, TIMESTAMP(fecha_vencimiento)))
     FROM licencia_digital WHERE id_licencia = ?`,
    [idLector, dias, dias, idLicencia],
  );
  const [filas] = await conexion.execute<({ fin: string } & RowDataPacket)[]>(
    "SELECT DATE_FORMAT(fecha_fin, '%d/%m/%Y %H:%i') AS fin FROM prestamo_digital WHERE id_prestamo_digital = ?",
    [resultado.insertId],
  );
  return { idPrestamo: resultado.insertId, fin: filas[0].fin };
}

type FilaPrestamoDigital = {
  id_prestamo_digital: number;
  id_lector: number;
  id_libro: number;
  vigente: number;
} & RowDataPacket;

export async function bloquearPrestamoDigital(conexion: Conexion, idPrestamo: number) {
  const [filas] = await conexion.execute<FilaPrestamoDigital[]>(
    `SELECT p.id_prestamo_digital, p.id_lector, ld.id_libro, (p.fecha_devolucion IS NULL AND p.fecha_fin > NOW()) AS vigente
     FROM prestamo_digital p JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
     WHERE p.id_prestamo_digital = ?
     FOR UPDATE OF p`,
    [idPrestamo],
  );
  return filas[0] ?? null;
}

// RN-27: devolver antes libera la licencia. La condición repite "vigente" por si cambió entre lectura y escritura.
export async function registrarDevolucionDigital(conexion: Conexion, idPrestamo: number): Promise<boolean> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    `UPDATE prestamo_digital SET fecha_devolucion = NOW()
     WHERE id_prestamo_digital = ? AND fecha_devolucion IS NULL AND fecha_fin > NOW()`,
    [idPrestamo],
  );
  return resultado.affectedRows === 1;
}

// ---------------------------------------------------------------------
// Reservas digitales y cola (RN-28, RN-48)
// ---------------------------------------------------------------------

// RN-48: las asignadas que no se confirmaron a tiempo pasan a vencida (y dejan de retener su licencia, RN-56).
export async function vencerReservasDigitales(conexion: Conexion, idLibro: number): Promise<number> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    `UPDATE reserva_digital SET estado = 'vencida', fecha_cierre = NOW()
     WHERE id_libro = ? AND estado = 'asignada' AND fecha_limite_confirmacion <= NOW()`,
    [idLibro],
  );
  return resultado.affectedRows;
}

type FilaEnCola = {
  id_reserva_digital: number;
  correo: string;
  nombre: string;
  dias_prestamo_digital: number;
} & RowDataPacket;

// RN-28: la cola es por orden de llegada (fecha y, a igual fecha, id).
export async function bloquearColaDigital(conexion: Conexion, idLibro: number): Promise<FilaEnCola[]> {
  const [filas] = await conexion.execute<FilaEnCola[]>(
    `SELECT r.id_reserva_digital, c.correo, l.nombre, t.dias_prestamo_digital
     FROM reserva_digital r
     JOIN lector l ON l.id_lector = r.id_lector
     JOIN cuenta c ON c.id_cuenta = l.id_cuenta
     JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
     WHERE r.id_libro = ? AND r.estado = 'activa'
     ORDER BY r.fecha_solicitud, r.id_reserva_digital
     FOR UPDATE OF r`,
    [idLibro],
  );
  return filas;
}

// Asigna el lote a la reserva; vence en las horas de configuración (RN-28). Devuelve la fecha límite legible.
export async function asignarReservaDigital(conexion: Conexion, idReserva: number, idLicencia: number): Promise<string> {
  await conexion.execute(
    `UPDATE reserva_digital r CROSS JOIN configuracion cf
     SET r.estado = 'asignada', r.id_licencia = ?, r.fecha_asignacion = NOW(),
         r.fecha_limite_confirmacion = NOW() + INTERVAL cf.horas_confirmar_reserva_digital HOUR
     WHERE r.id_reserva_digital = ? AND r.estado = 'activa'`,
    [idLicencia, idReserva],
  );
  const [filas] = await conexion.execute<({ limite: string } & RowDataPacket)[]>(
    "SELECT DATE_FORMAT(fecha_limite_confirmacion, '%d/%m/%Y %H:%i') AS limite FROM reserva_digital WHERE id_reserva_digital = ?",
    [idReserva],
  );
  return filas[0].limite;
}

type FilaReservaDigital = {
  id_reserva_digital: number;
  id_lector: number;
  id_libro: number;
  estado: "activa" | "asignada" | "cumplida" | "vencida" | "cancelada";
  id_licencia: number | null;
  vigente: number; // asignada y dentro del plazo de confirmación
} & RowDataPacket;

const SELECT_RESERVA_DIGITAL = `
  SELECT id_reserva_digital, id_lector, id_libro, estado, id_licencia,
         (estado = 'asignada' AND fecha_limite_confirmacion > NOW()) AS vigente
  FROM reserva_digital`;

export async function bloquearReservaDigitalPorId(conexion: Conexion, idReserva: number) {
  const [filas] = await conexion.execute<FilaReservaDigital[]>(`${SELECT_RESERVA_DIGITAL} WHERE id_reserva_digital = ? FOR UPDATE`, [idReserva]);
  return filas[0] ?? null;
}

// La reserva viva del lector por el título (uq_reserva_digital_viva: a lo sumo una).
export async function bloquearReservaDigitalViva(conexion: Conexion, idLector: number, idLibro: number) {
  const [filas] = await conexion.execute<FilaReservaDigital[]>(
    `${SELECT_RESERVA_DIGITAL} WHERE id_lector = ? AND id_libro = ? AND estado IN ('activa', 'asignada') FOR UPDATE`,
    [idLector, idLibro],
  );
  return filas[0] ?? null;
}

export async function insertarReservaDigital(conexion: Conexion, idLector: number, idLibro: number): Promise<number> {
  const [resultado] = await conexion.execute<ResultSetHeader>(
    "INSERT INTO reserva_digital (id_lector, id_libro) VALUES (?, ?)",
    [idLector, idLibro],
  );
  return resultado.insertId;
}

export async function posicionEnColaDigital(conexion: Conexion, idReserva: number): Promise<number> {
  const [filas] = await conexion.execute<({ puesto: number } & RowDataPacket)[]>(
    `SELECT COUNT(*) AS puesto FROM reserva_digital r
     JOIN reserva_digital mia ON mia.id_reserva_digital = ?
     WHERE r.id_libro = mia.id_libro AND r.estado = 'activa'
       AND (r.fecha_solicitud, r.id_reserva_digital) <= (mia.fecha_solicitud, mia.id_reserva_digital)`,
    [idReserva],
  );
  return Number(filas[0].puesto);
}

export async function cumplirReservaDigital(conexion: Conexion, idReserva: number, idPrestamo: number) {
  await conexion.execute(
    `UPDATE reserva_digital SET estado = 'cumplida', id_prestamo_digital = ?, fecha_cierre = NOW()
     WHERE id_reserva_digital = ? AND estado = 'asignada'`,
    [idPrestamo, idReserva],
  );
}

export async function cancelarReservaDigital(conexion: Conexion, idReserva: number) {
  await conexion.execute(
    `UPDATE reserva_digital SET estado = 'cancelada', fecha_cierre = NOW()
     WHERE id_reserva_digital = ? AND estado IN ('activa', 'asignada')`,
    [idReserva],
  );
}

// ---------------------------------------------------------------------
// Lecturas para las páginas (sin bloqueo)
// ---------------------------------------------------------------------

export type DisponibilidadDigital = {
  tiene_edicion: boolean;
  licencias: number; // total en lotes vigentes
  libres: number;
  en_cola: number; // reservas activas
};

// Para la página del libro. Mismo cálculo que bloquearLotesDelTitulo, pero solo lectura: es informativo, la
// acción vuelve a contar con candado.
export async function obtenerDisponibilidadDigital(idLibro: number): Promise<DisponibilidadDigital> {
  const [filas] = await pool.execute<({ ediciones: number; licencias: number; en_uso: number; en_cola: number } & RowDataPacket)[]>(
    `SELECT
       (SELECT COUNT(*) FROM edicion_digital WHERE id_libro = ? AND formato = 'pdf') AS ediciones,
       (SELECT COALESCE(SUM(cantidad), 0) FROM licencia_digital
        WHERE id_libro = ? AND (fecha_vencimiento IS NULL OR TIMESTAMP(fecha_vencimiento) > NOW())) AS licencias,
       (SELECT COUNT(*) FROM prestamo_digital p JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
        WHERE ld.id_libro = ? AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW()
          AND (ld.fecha_vencimiento IS NULL OR TIMESTAMP(ld.fecha_vencimiento) > NOW()))
       + (SELECT COUNT(*) FROM reserva_digital WHERE id_libro = ? AND estado = 'asignada' AND fecha_limite_confirmacion > NOW())
         AS en_uso,
       (SELECT COUNT(*) FROM reserva_digital WHERE id_libro = ? AND estado = 'activa') AS en_cola`,
    [idLibro, idLibro, idLibro, idLibro, idLibro],
  );
  const f = filas[0];
  const licencias = Number(f.licencias);
  return {
    tiene_edicion: Number(f.ediciones) > 0,
    licencias,
    libres: Math.max(0, licencias - Number(f.en_uso)),
    en_cola: Number(f.en_cola),
  };
}

export type SituacionDigitalEnTitulo = {
  id_prestamo_digital: number | null; // préstamo vigente
  fin_prestamo: string | null;
  compra: boolean;
  id_reserva_digital: number | null; // reserva viva
  estado_reserva: "activa" | "asignada" | null;
  limite_confirmacion: string | null;
  puesto: number | null; // en la cola, si está activa
};

// Lo que el lector tiene de ese título, para decidir qué botón mostrar.
export async function obtenerSituacionDigitalEnTitulo(idLector: number, idLibro: number): Promise<SituacionDigitalEnTitulo> {
  const [prestamos] = await pool.execute<({ id: number; fin: string } & RowDataPacket)[]>(
    `SELECT p.id_prestamo_digital AS id, DATE_FORMAT(p.fecha_fin, '%d/%m/%Y %H:%i') AS fin
     FROM prestamo_digital p JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
     WHERE p.id_lector = ? AND ld.id_libro = ? AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW()
     LIMIT 1`,
    [idLector, idLibro],
  );
  const [compras] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM acceso_digital WHERE id_lector = ? AND id_libro = ?", [idLector, idLibro]);
  const [reservas] = await pool.execute<({ id: number; estado: "activa" | "asignada"; limite: string | null; puesto: number | null } & RowDataPacket)[]>(
    `SELECT r.id_reserva_digital AS id, r.estado,
            DATE_FORMAT(r.fecha_limite_confirmacion, '%d/%m/%Y %H:%i') AS limite,
            IF(r.estado = 'activa',
               (SELECT COUNT(*) FROM reserva_digital o
                WHERE o.id_libro = r.id_libro AND o.estado = 'activa'
                  AND (o.fecha_solicitud, o.id_reserva_digital) <= (r.fecha_solicitud, r.id_reserva_digital)),
               NULL) AS puesto
     FROM reserva_digital r
     WHERE r.id_lector = ? AND r.id_libro = ? AND r.estado IN ('activa', 'asignada')`,
    [idLector, idLibro],
  );
  return {
    id_prestamo_digital: prestamos[0]?.id ?? null,
    fin_prestamo: prestamos[0]?.fin ?? null,
    compra: compras.length > 0,
    id_reserva_digital: reservas[0]?.id ?? null,
    estado_reserva: reservas[0]?.estado ?? null,
    limite_confirmacion: reservas[0]?.limite ?? null,
    puesto: reservas[0]?.puesto === null || reservas[0]?.puesto === undefined ? null : Number(reservas[0].puesto),
  };
}

export type PrestamoDigitalDeLector = { id_prestamo_digital: number; isbn: string; titulo: string; fin: string };
export type ReservaDigitalDeLector = {
  id_reserva_digital: number;
  isbn: string;
  titulo: string;
  estado: "activa" | "asignada";
  limite_confirmacion: string | null;
  puesto: number | null;
};

// "Mi cuenta": préstamos digitales vigentes (con su enlace de lectura) y reservas digitales vivas.
export async function obtenerDigitalDelLector(idLector: number) {
  const [prestamos] = await pool.execute<(PrestamoDigitalDeLector & RowDataPacket)[]>(
    `SELECT p.id_prestamo_digital, lb.isbn, lb.titulo, DATE_FORMAT(p.fecha_fin, '%d/%m/%Y %H:%i') AS fin
     FROM prestamo_digital p
     JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
     JOIN libro lb ON lb.id_libro = ld.id_libro
     WHERE p.id_lector = ? AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW()
     ORDER BY p.fecha_fin`,
    [idLector],
  );
  const [reservas] = await pool.execute<(ReservaDigitalDeLector & RowDataPacket)[]>(
    `SELECT r.id_reserva_digital, lb.isbn, lb.titulo, r.estado,
            DATE_FORMAT(r.fecha_limite_confirmacion, '%d/%m/%Y %H:%i') AS limite_confirmacion,
            IF(r.estado = 'activa',
               (SELECT COUNT(*) FROM reserva_digital o
                WHERE o.id_libro = r.id_libro AND o.estado = 'activa'
                  AND (o.fecha_solicitud, o.id_reserva_digital) <= (r.fecha_solicitud, r.id_reserva_digital)),
               NULL) AS puesto
     FROM reserva_digital r JOIN libro lb ON lb.id_libro = r.id_libro
     WHERE r.id_lector = ? AND r.estado IN ('activa', 'asignada')
     ORDER BY r.fecha_solicitud`,
    [idLector],
  );
  return {
    prestamos,
    reservas: reservas.map((r) => ({ ...r, puesto: r.puesto === null ? null : Number(r.puesto) })),
  };
}

// ---------------------------------------------------------------------
// Lectura (RN-29, RN-30, RN-61)
// ---------------------------------------------------------------------

export type AccesoDeLectura = { titulo: string; clave_archivo: string; por: "prestamo" | "compra"; fin: string | null };

// ¿Puede este lector leer este título AHORA? Préstamo vigente o compra, y que exista la edición PDF.
// null = no puede (o el título no existe): la ruta responde igual en los dos casos.
export async function obtenerAccesoDeLectura(idLector: number, isbn: string): Promise<AccesoDeLectura | null> {
  const [filas] = await pool.execute<(AccesoDeLectura & RowDataPacket)[]>(
    `SELECT lb.titulo, e.clave_archivo,
            IF(ad.id_lector IS NOT NULL, 'compra', 'prestamo') AS por,
            IF(ad.id_lector IS NOT NULL, NULL,
               (SELECT DATE_FORMAT(MAX(p.fecha_fin), '%d/%m/%Y %H:%i') FROM prestamo_digital p
                JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
                WHERE p.id_lector = ? AND ld.id_libro = lb.id_libro AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW())) AS fin
     FROM libro lb
     JOIN edicion_digital e ON e.id_libro = lb.id_libro AND e.formato = 'pdf'
     LEFT JOIN acceso_digital ad ON ad.id_libro = lb.id_libro AND ad.id_lector = ?
     WHERE lb.isbn = ?
       AND (ad.id_lector IS NOT NULL OR EXISTS (
             SELECT 1 FROM prestamo_digital p JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
             WHERE p.id_lector = ? AND ld.id_libro = lb.id_libro AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW()))`,
    [idLector, idLector, isbn, idLector],
  );
  return filas[0] ?? null;
}

// RN-41, RN-61: una compra queda "abierta" (ya no reembolsable) la primera vez que se lee. Solo la primera.
export async function marcarPrimeraLectura(idLector: number, isbn: string) {
  await pool.execute(
    `UPDATE acceso_digital ad JOIN libro lb ON lb.id_libro = ad.id_libro
     SET ad.fecha_primera_lectura = NOW()
     WHERE ad.id_lector = ? AND lb.isbn = ? AND ad.fecha_primera_lectura IS NULL`,
    [idLector, isbn],
  );
}

// ---------------------------------------------------------------------
// Panel: lotes de licencias (RN-25, RN-33, RN-54)
// ---------------------------------------------------------------------

export type LoteDelPanel = {
  id_licencia: number;
  cantidad: number;
  en_uso: number;
  adquirido: string;
  vence: string | null;
  vigente: number;
};

export type TituloConLicencias = {
  id_libro: number;
  isbn: string;
  titulo: string;
  en_cola: number;
  lotes: LoteDelPanel[];
};

// Títulos con edición PDF y sus lotes (también los vencidos, para el historial), con el uso de cada lote.
export async function obtenerLicenciasPorTitulo(): Promise<TituloConLicencias[]> {
  const [titulos] = await pool.execute<({ id_libro: number; isbn: string; titulo: string; en_cola: number } & RowDataPacket)[]>(
    `SELECT lb.id_libro, lb.isbn, lb.titulo,
            (SELECT COUNT(*) FROM reserva_digital r WHERE r.id_libro = lb.id_libro AND r.estado = 'activa') AS en_cola
     FROM libro lb
     WHERE EXISTS (SELECT 1 FROM edicion_digital e WHERE e.id_libro = lb.id_libro AND e.formato = 'pdf')
     ORDER BY lb.titulo`,
  );
  const [lotes] = await pool.execute<(LoteDelPanel & { id_libro: number } & RowDataPacket)[]>(
    `SELECT ld.id_licencia, ld.id_libro, ld.cantidad,
            DATE_FORMAT(ld.fecha_adquisicion, '%d/%m/%Y') AS adquirido,
            DATE_FORMAT(ld.fecha_vencimiento, '%d/%m/%Y') AS vence,
            (ld.fecha_vencimiento IS NULL OR TIMESTAMP(ld.fecha_vencimiento) > NOW()) AS vigente,
            (SELECT COUNT(*) FROM prestamo_digital p
             WHERE p.id_licencia = ld.id_licencia AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW())
            + (SELECT COUNT(*) FROM reserva_digital r
               WHERE r.id_licencia = ld.id_licencia AND r.estado = 'asignada' AND r.fecha_limite_confirmacion > NOW()) AS en_uso
     FROM licencia_digital ld
     ORDER BY ld.fecha_adquisicion, ld.id_licencia`,
  );
  return titulos.map((t) => ({
    ...t,
    en_cola: Number(t.en_cola),
    lotes: lotes.filter((l) => l.id_libro === t.id_libro).map((l) => ({ ...l, en_uso: Number(l.en_uso) })),
  }));
}

export async function existeEdicionPdf(conexion: Conexion, idLibro: number): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>(
    "SELECT 1 FROM edicion_digital WHERE id_libro = ? AND formato = 'pdf'",
    [idLibro],
  );
  return filas.length > 0;
}

export async function insertarLote(
  conexion: Conexion,
  datos: { idLibro: number; cantidad: number; adquisicion: string; vencimiento: string | null; idEmpleado: number },
) {
  await conexion.execute(
    `INSERT INTO licencia_digital (id_libro, cantidad, fecha_adquisicion, fecha_vencimiento, id_empleado_registra)
     VALUES (?, ?, ?, ?, ?)`,
    [datos.idLibro, datos.cantidad, datos.adquisicion, datos.vencimiento, datos.idEmpleado],
  );
}
