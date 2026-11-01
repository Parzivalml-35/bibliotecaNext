import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

// SQL de cuentas de lector: registro y verificación (RN-32, RN-70), "Mi cuenta" y ficha en mostrador
// (RN-01, RN-03), validación con documento (D-03).

type Conexion = PoolConnection;

// ---------------------------------------------------------------------
// Registro y verificación (RN-32, RN-70)
// ---------------------------------------------------------------------

export async function existeCuenta(conexion: Conexion, correo: string): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>("SELECT 1 FROM cuenta WHERE correo = ? FOR SHARE", [correo]);
  return filas.length > 0;
}

// RN-74: el documento es único en la red. Devuelve el correo de la cuenta dueña (para avisarle) o null.
export async function correoDelDocumento(conexion: Conexion, tipoDocumento: string, numeroDocumento: string) {
  const [filas] = await conexion.execute<({ correo: string } & RowDataPacket)[]>(
    `SELECT c.correo FROM lector l JOIN cuenta c ON c.id_cuenta = l.id_cuenta
     WHERE l.tipo_documento = ? AND l.numero_documento = ? FOR SHARE`,
    [tipoDocumento, numeroDocumento],
  );
  return filas[0]?.correo ?? null;
}

export async function existeCiudad(conexion: Conexion, idCiudad: number): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>("SELECT 1 FROM ciudad WHERE id_ciudad = ?", [idCiudad]);
  return filas.length > 0;
}

// Para el formulario de registro (catálogo editable, C-02).
export async function listarCiudades() {
  const [filas] = await pool.execute<({ id_ciudad: number; nombre: string; departamento: string } & RowDataPacket)[]>(
    "SELECT id_ciudad, nombre, departamento FROM ciudad ORDER BY nombre",
  );
  return filas;
}

export type DatosRegistro = {
  correo: string;
  passwordHash: string;
  nombre: string;
  apellido: string;
  nacimiento: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono: string;
  calle: string;
  codigoPostal: string | null;
  idCiudad: number;
  tokenHash: string;
};

// Crea cuenta + lector (con el tipo inicial de la configuración, C-04) + token de verificación, todo con
// valores calculados en MySQL. Devuelve las horas de validez del enlace, para el mensaje del correo.
export async function insertarLectorRegistrado(conexion: Conexion, datos: DatosRegistro): Promise<number> {
  const [cuenta] = await conexion.execute<ResultSetHeader>(
    "INSERT INTO cuenta (correo, password_hash) VALUES (?, ?)",
    [datos.correo, datos.passwordHash],
  );
  await conexion.execute(
    `INSERT INTO lector (id_cuenta, id_tipo_lector, nombre, apellido, fecha_nacimiento, tipo_documento, numero_documento,
                         telefono, calle, codigo_postal, id_ciudad)
     SELECT ?, id_tipo_lector_registro, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM configuracion`,
    [cuenta.insertId, datos.nombre, datos.apellido, datos.nacimiento, datos.tipoDocumento, datos.numeroDocumento,
     datos.telefono, datos.calle, datos.codigoPostal, datos.idCiudad],
  );
  await conexion.execute(
    `INSERT INTO token_cuenta (id_cuenta, token_hash, tipo, expira_en)
     SELECT ?, ?, 'verificar_correo', NOW() + INTERVAL horas_verificacion_correo HOUR FROM configuracion`,
    [cuenta.insertId, datos.tokenHash],
  );
  const [filas] = await conexion.execute<({ horas: number } & RowDataPacket)[]>(
    "SELECT horas_verificacion_correo AS horas FROM configuracion",
  );
  return filas[0].horas;
}

type FilaToken = { id_token: number; id_cuenta: number; vigente: number; usado: number } & RowDataPacket;

export async function bloquearTokenDeVerificacion(conexion: Conexion, tokenHash: string) {
  const [filas] = await conexion.execute<FilaToken[]>(
    `SELECT id_token, id_cuenta, expira_en > NOW() AS vigente, usado_en IS NOT NULL AS usado
     FROM token_cuenta WHERE token_hash = ? AND tipo = 'verificar_correo'
     FOR UPDATE`,
    [tokenHash],
  );
  return filas[0] ?? null;
}

// Un solo uso (RN-32): el token se marca usado y la cuenta queda verificada en la misma transacción.
export async function usarTokenYVerificar(conexion: Conexion, idToken: number, idCuenta: number) {
  await conexion.execute("UPDATE token_cuenta SET usado_en = NOW() WHERE id_token = ? AND usado_en IS NULL", [idToken]);
  await conexion.execute(
    "UPDATE cuenta SET fecha_verificacion = NOW() WHERE id_cuenta = ? AND fecha_verificacion IS NULL",
    [idCuenta],
  );
}

// ---------------------------------------------------------------------
// Resumen de un lector: "Mi cuenta" y ficha en mostrador
// ---------------------------------------------------------------------

export type EstadoCuenta = "registrada" | "verificada" | "validada" | "desactivada";

export type ResumenLector = {
  id_lector: number;
  nombre: string;
  correo: string;
  tipo_lector: string;
  estado_cuenta: EstadoCuenta; // RN-01: deducido de las fechas
  tipo_documento: string; // RN-74: obligatorio desde el registro
  numero_documento: string;
  telefono: string;
  direccion: string; // calle, ciudad (RN-74: para ubicar a quien no devuelve)
  edad: number;
  prestamos_vencidos: number; // RN-03
  multas_pendientes: number;
  monto_pendiente: number;
};

export type PrestamoDeLector = {
  id_prestamo: number;
  titulo: string;
  codigo_barras: string;
  sede: string;
  fecha_vencimiento: string;
  dias_atraso: number;
  perdido: number; // RN-71
  dias_restantes: number; // RN-76: días hasta el vencimiento (negativo si venció)
  por_vencer: number; // RN-76: 1 si faltan dias_aviso_vencimiento días o menos y no venció
};

export type MultaDeLector = {
  id_multa: number;
  titulo: string;
  tipo: "retraso" | "reposicion";
  monto: number;
  estado: "pendiente" | "pagada" | "anulada";
  fecha_generada: string;
  id_sede_prestamo: number; // RN-67: el coordinador de esta sede puede anularla
  motivo_anulacion: string | null;
  pago_en_linea_pendiente: number | null; // id del pago simulado sin confirmar, si hay
};

export type ReservaDeLector = {
  id_reserva: number;
  isbn: string;
  titulo: string;
  sede: string;
  estado: "activa" | "asignada";
  posicion: number | null; // en la cola (solo activas)
  fecha_limite_recogida: string | null;
};

const SELECT_RESUMEN = `
  SELECT l.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS nombre, c.correo, t.nombre AS tipo_lector,
         CASE WHEN c.fecha_desactivacion IS NOT NULL THEN 'desactivada'
              WHEN l.fecha_validacion IS NOT NULL THEN 'validada'
              WHEN c.fecha_verificacion IS NOT NULL THEN 'verificada'
              ELSE 'registrada' END AS estado_cuenta,
         l.tipo_documento, l.numero_documento, l.telefono, CONCAT(l.calle, ', ', ci.nombre) AS direccion,
         TIMESTAMPDIFF(YEAR, l.fecha_nacimiento, CURDATE()) AS edad,
         (SELECT COUNT(*) FROM prestamo_fisico p JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
          WHERE p.id_lector = l.id_lector AND p.fecha_devolucion IS NULL AND e.estado <> 'perdido'
            AND p.fecha_vencimiento < CURDATE()) AS prestamos_vencidos,
         (SELECT COUNT(*) FROM multa m JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
          WHERE p.id_lector = l.id_lector AND m.estado = 'pendiente') AS multas_pendientes,
         (SELECT COALESCE(SUM(m.monto), 0) FROM multa m JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
          WHERE p.id_lector = l.id_lector AND m.estado = 'pendiente') AS monto_pendiente
  FROM lector l
  JOIN cuenta c ON c.id_cuenta = l.id_cuenta
  JOIN tipo_lector t ON t.id_tipo_lector = l.id_tipo_lector
  JOIN ciudad ci ON ci.id_ciudad = l.id_ciudad`;

export async function obtenerResumenLector(idLector: number): Promise<ResumenLector | null> {
  const [filas] = await pool.execute<(ResumenLector & RowDataPacket)[]>(`${SELECT_RESUMEN} WHERE l.id_lector = ?`, [idLector]);
  return filas[0] ? { ...filas[0], monto_pendiente: Number(filas[0].monto_pendiente) } : null;
}

// Mostrador: buscar por correo exacto o por número de documento. Hasta 10 resultados.
export async function buscarLectores(texto: string): Promise<ResumenLector[]> {
  const [filas] = await pool.execute<(ResumenLector & RowDataPacket)[]>(
    `${SELECT_RESUMEN} WHERE c.correo = ? OR l.numero_documento = ? ORDER BY l.apellido LIMIT 10`,
    [texto.toLowerCase(), texto],
  );
  return filas.map((f) => ({ ...f, monto_pendiente: Number(f.monto_pendiente) }));
}

export async function obtenerPrestamosDeLector(idLector: number): Promise<PrestamoDeLector[]> {
  const [filas] = await pool.execute<(PrestamoDeLector & RowDataPacket)[]>(
    `SELECT p.id_prestamo, l.titulo, e.codigo_barras, sd.nombre AS sede,
            DATE_FORMAT(p.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento,
            GREATEST(DATEDIFF(CURDATE(), p.fecha_vencimiento), 0) AS dias_atraso, e.estado = 'perdido' AS perdido,
            DATEDIFF(p.fecha_vencimiento, CURDATE()) AS dias_restantes, -- negativo si ya venció
            DATEDIFF(p.fecha_vencimiento, CURDATE()) BETWEEN 0 AND cf.dias_aviso_vencimiento AS por_vencer -- RN-76
     FROM prestamo_fisico p
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN libro l ON l.id_libro = e.id_libro
     JOIN sede sd ON sd.id_sede = p.id_sede_prestamo
     CROSS JOIN configuracion cf
     WHERE p.id_lector = ? AND p.fecha_devolucion IS NULL
     ORDER BY p.fecha_vencimiento`,
    [idLector],
  );
  return filas;
}

export async function obtenerMultasDeLector(idLector: number): Promise<MultaDeLector[]> {
  const [filas] = await pool.execute<(MultaDeLector & RowDataPacket)[]>(
    `SELECT m.id_multa, l.titulo, m.tipo, m.monto, m.estado, DATE_FORMAT(m.fecha_generada, '%Y-%m-%d') AS fecha_generada,
            p.id_sede_prestamo, m.motivo_anulacion,
            (SELECT pg.id_pago FROM pago pg WHERE pg.id_multa = m.id_multa AND pg.estado = 'pendiente'
             ORDER BY pg.id_pago DESC LIMIT 1) AS pago_en_linea_pendiente
     FROM multa m
     JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN libro l ON l.id_libro = e.id_libro
     WHERE p.id_lector = ?
     ORDER BY m.estado = 'pendiente' DESC, m.fecha_generada DESC`,
    [idLector],
  );
  return filas;
}

export async function obtenerReservasDeLector(idLector: number): Promise<ReservaDeLector[]> {
  const [filas] = await pool.execute<(ReservaDeLector & RowDataPacket)[]>(
    `SELECT r.id_reserva, l.isbn, l.titulo, sd.nombre AS sede, r.estado,
            IF(r.estado = 'activa',
               (SELECT COUNT(*) FROM reserva_fisica x
                WHERE x.id_libro = r.id_libro AND x.id_sede = r.id_sede AND x.estado = 'activa'
                  AND (x.fecha_solicitud, x.id_reserva) <= (r.fecha_solicitud, r.id_reserva)),
               NULL) AS posicion,
            DATE_FORMAT(r.fecha_limite_recogida, '%Y-%m-%d %H:%i') AS fecha_limite_recogida
     FROM reserva_fisica r
     JOIN libro l ON l.id_libro = r.id_libro
     JOIN sede sd ON sd.id_sede = r.id_sede
     WHERE r.id_lector = ? AND r.estado IN ('activa', 'asignada')
     ORDER BY r.fecha_solicitud`,
    [idLector],
  );
  return filas;
}

// La reserva viva del lector por una obra, para la página del libro: después de reservar, el formulario
// desaparece y este resumen dice cómo quedó (puesto en la cola o plazo para recoger).
export async function obtenerReservaVivaDeObra(idLector: number, idLibro: number) {
  const [filas] = await pool.execute<
    ({ estado: string; sede: string; posicion: number; fecha_limite_recogida: string | null } & RowDataPacket)[]
  >(
    `SELECT r.estado, sd.nombre AS sede,
            (SELECT COUNT(*) FROM reserva_fisica x
             WHERE x.id_libro = r.id_libro AND x.id_sede = r.id_sede AND x.estado = 'activa'
               AND (x.fecha_solicitud, x.id_reserva) <= (r.fecha_solicitud, r.id_reserva)) AS posicion,
            DATE_FORMAT(r.fecha_limite_recogida, '%Y-%m-%d %H:%i') AS fecha_limite_recogida
     FROM reserva_fisica r JOIN sede sd ON sd.id_sede = r.id_sede
     WHERE r.id_lector = ? AND r.id_libro = ? AND r.estado IN ('activa', 'asignada')`,
    [idLector, idLibro],
  );
  return filas[0] ?? null;
}

// El préstamo abierto del lector por una obra, para la página del libro (RN-68, RN-75): si ya la tiene,
// se dice en vez de ofrecer el formulario de reserva. Mismo criterio que tienePrestadaLaObra (perdidos no cuentan).
export async function obtenerPrestamoAbiertoDeObra(idLector: number, idLibro: number) {
  const [filas] = await pool.execute<({ sede: string; fecha_vencimiento: string } & RowDataPacket)[]>(
    `SELECT sd.nombre AS sede, DATE_FORMAT(p.fecha_vencimiento, '%Y-%m-%d') AS fecha_vencimiento
     FROM prestamo_fisico p
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN sede sd ON sd.id_sede = p.id_sede_prestamo
     WHERE p.id_lector = ? AND e.id_libro = ? AND p.fecha_devolucion IS NULL AND e.estado <> 'perdido'
     ORDER BY p.fecha_vencimiento LIMIT 1`,
    [idLector, idLibro],
  );
  return filas[0] ?? null;
}

// ---------------------------------------------------------------------
// Validación en mostrador (D-03, RN-70)
// ---------------------------------------------------------------------

export async function obtenerTiposDeLector() {
  const [filas] = await pool.execute<({ id_tipo_lector: number; nombre: string } & RowDataPacket)[]>(
    "SELECT id_tipo_lector, nombre FROM tipo_lector ORDER BY nombre",
  );
  return filas;
}

type FilaLectorAValidar = { id_lector: number; nombre: string; verificada: number; validado: number } & RowDataPacket;

export async function bloquearLectorAValidar(conexion: Conexion, idLector: number) {
  const [filas] = await conexion.execute<FilaLectorAValidar[]>(
    `SELECT l.id_lector, CONCAT(l.nombre, ' ', l.apellido) AS nombre,
            c.fecha_verificacion IS NOT NULL AS verificada, l.fecha_validacion IS NOT NULL AS validado
     FROM lector l JOIN cuenta c ON c.id_cuenta = l.id_cuenta
     WHERE l.id_lector = ? AND c.fecha_desactivacion IS NULL
     FOR UPDATE OF l`,
    [idLector],
  );
  return filas[0] ?? null;
}

export async function existeTipoLector(conexion: Conexion, idTipoLector: number): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>("SELECT 1 FROM tipo_lector WHERE id_tipo_lector = ?", [idTipoLector]);
  return filas.length > 0;
}

// D-03: quién y cuándo. El empleado puede corregir el documento si no coincide con el original (RN-70).
export async function registrarValidacion(
  conexion: Conexion,
  datos: { idLector: number; tipoDocumento: string; numeroDocumento: string; idTipoLector: number; idEmpleado: number },
) {
  await conexion.execute(
    `UPDATE lector SET tipo_documento = ?, numero_documento = ?, id_tipo_lector = ?,
                       fecha_validacion = NOW(), id_empleado_validador = ?
     WHERE id_lector = ? AND fecha_validacion IS NULL`,
    [datos.tipoDocumento, datos.numeroDocumento, datos.idTipoLector, datos.idEmpleado, datos.idLector],
  );
}
