import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { RolEmpleado } from "@/lib/definitions";

// SQL de cuentas y sesiones (RN-31, RN-63, RN-64). La lógica de cookies y tokens está en lib/sesion.ts.

type FilaCuentaLogin = {
  id_cuenta: number;
  password_hash: string;
  desactivada: number; // 1/0: MySQL devuelve los booleanos como números
  rol_empleado: RolEmpleado | null; // rol del perfil de empleado activo (NULL si no tiene): decide a qué sección del panel entra
  es_lector: number; // si no es empleado pero es lector, va a "Mi cuenta"
} & RowDataPacket;

export async function buscarCuentaPorCorreo(correo: string) {
  const [filas] = await pool.execute<FilaCuentaLogin[]>(
    `SELECT c.id_cuenta, c.password_hash, c.fecha_desactivacion IS NOT NULL AS desactivada,
            -- uq_empleado_cuenta: como mucho un empleado por cuenta, así que la subconsulta da una fila o ninguna.
            (SELECT e.rol FROM empleado e WHERE e.id_cuenta = c.id_cuenta AND e.activo) AS rol_empleado,
            EXISTS (SELECT 1 FROM lector l WHERE l.id_cuenta = c.id_cuenta) AS es_lector
     FROM cuenta c WHERE c.correo = ?`,
    [correo],
  );
  return filas[0] ?? null;
}

// Crea la sesión con el vencimiento calculado EN MySQL (NOW() + horas_sesion): así la fecha guardada
// y la comparación de verificarSesion usan el mismo reloj y la misma zona horaria. Devuelve las horas
// para que la cookie dure lo mismo. Aprovecha para borrar las sesiones vencidas de esa cuenta.
export async function insertarSesion(idCuenta: number, tokenHash: string): Promise<number> {
  await pool.execute("DELETE FROM sesion WHERE id_cuenta = ? AND expira_en <= NOW()", [idCuenta]);
  await pool.execute(
    `INSERT INTO sesion (id_cuenta, token_hash, expira_en)
     SELECT ?, ?, NOW() + INTERVAL horas_sesion HOUR FROM configuracion`,
    [idCuenta, tokenHash],
  );
  const [filas] = await pool.execute<({ horas_sesion: number } & RowDataPacket)[]>(
    "SELECT horas_sesion FROM configuracion",
  );
  return filas[0].horas_sesion;
}

type FilaSesion = {
  id_cuenta: number;
  correo: string;
  id_empleado: number | null;
  nombre: string | null;
  apellido: string | null;
  rol: RolEmpleado | null;
  id_sede: number | null;
  sede: string | null;
  id_lector: number | null;
  nombre_lector: string | null;
  verificada: number;
  avatar_estilo: string;
  avatar_semilla: string;
  avatar_clave: string | null; // RN-82: NULL = usa el avatar generado
} & RowDataPacket;

// RN-64 en una sola consulta: la sesión existe, no venció y la cuenta no está desactivada. El empleado
// llega por LEFT JOIN solo si está activo: una cuenta sin empleado activo sigue siendo una sesión válida
// (un lector), pero no entra al panel.
export async function buscarSesionVigente(tokenHash: string) {
  const [filas] = await pool.execute<FilaSesion[]>(
    `SELECT c.id_cuenta, c.correo, e.id_empleado, e.nombre, e.apellido, e.rol, e.id_sede, sd.nombre AS sede,
            lc.id_lector, CONCAT(lc.nombre, ' ', lc.apellido) AS nombre_lector, c.fecha_verificacion IS NOT NULL AS verificada,
            c.avatar_estilo, c.avatar_semilla, c.avatar_clave
     FROM sesion s
     JOIN cuenta c ON c.id_cuenta = s.id_cuenta
     LEFT JOIN empleado e ON e.id_cuenta = c.id_cuenta AND e.activo
     LEFT JOIN sede sd ON sd.id_sede = e.id_sede
     LEFT JOIN lector lc ON lc.id_cuenta = c.id_cuenta
     WHERE s.token_hash = ? AND s.expira_en > NOW() AND c.fecha_desactivacion IS NULL`,
    [tokenHash],
  );
  return filas[0] ?? null;
}

export async function borrarSesion(tokenHash: string): Promise<boolean> {
  const [resultado] = await pool.execute<ResultSetHeader>("DELETE FROM sesion WHERE token_hash = ?", [tokenHash]);
  return resultado.affectedRows > 0;
}

// RN-78: contraseña nueva y cierre de las DEMÁS sesiones, en la misma transacción (o las dos cosas, o ninguna).
// `tokenHashActual` es la sesión que se conserva: la del navegador que hizo el cambio. Devuelve cuántas se cerraron.
export async function cambiarContrasenaYCerrarOtras(
  conexion: PoolConnection,
  idCuenta: number,
  passwordHash: string,
  tokenHashActual: string,
): Promise<number> {
  await conexion.execute("UPDATE cuenta SET password_hash = ? WHERE id_cuenta = ?", [passwordHash, idCuenta]);
  const [resultado] = await conexion.execute<ResultSetHeader>(
    "DELETE FROM sesion WHERE id_cuenta = ? AND token_hash <> ?",
    [idCuenta, tokenHashActual],
  );
  return resultado.affectedRows;
}

// ---------------------------------------------------------------------
// Cambio de correo (RN-79)
// ---------------------------------------------------------------------

// ¿Hay ya una cuenta con ese correo? FOR SHARE: dentro de la transacción, nadie puede tomar el correo hasta que
// esta termine. Desactivadas incluidas: su correo sigue ocupado (UNIQUE de cuenta.correo).
export async function correoOcupado(conexion: PoolConnection, correo: string): Promise<boolean> {
  const [filas] = await conexion.execute<RowDataPacket[]>("SELECT 1 FROM cuenta WHERE correo = ? FOR SHARE", [correo]);
  return filas.length > 0;
}

// Una solicitud nueva reemplaza a las anteriores sin usar: solo vale el último enlace, el del correo que el usuario
// escribió por última vez. Devuelve las horas de validez (RN-70), para el texto del correo.
export async function crearTokenCambioCorreo(
  conexion: PoolConnection,
  idCuenta: number,
  correoNuevo: string,
  tokenHash: string,
): Promise<number> {
  await conexion.execute(
    "DELETE FROM token_cuenta WHERE id_cuenta = ? AND tipo = 'cambiar_correo' AND usado_en IS NULL",
    [idCuenta],
  );
  await conexion.execute(
    `INSERT INTO token_cuenta (id_cuenta, token_hash, tipo, correo_nuevo, expira_en)
     SELECT ?, ?, 'cambiar_correo', ?, NOW() + INTERVAL horas_verificacion_correo HOUR FROM configuracion`,
    [idCuenta, tokenHash, correoNuevo],
  );
  const [filas] = await conexion.execute<({ horas_verificacion_correo: number } & RowDataPacket)[]>(
    "SELECT horas_verificacion_correo FROM configuracion",
  );
  return filas[0].horas_verificacion_correo;
}

type FilaTokenCorreo = {
  id_token: number;
  id_cuenta: number;
  correo_nuevo: string;
  correo_actual: string;
  vigente: number;
  usado: number;
  desactivada: number;
} & RowDataPacket;

// FOR UPDATE OF t: bloquea el token (dos clics a la vez no lo usan dos veces) y la fila de la cuenta, que se va a cambiar.
export async function bloquearTokenCambioCorreo(conexion: PoolConnection, tokenHash: string) {
  const [filas] = await conexion.execute<FilaTokenCorreo[]>(
    `SELECT t.id_token, t.id_cuenta, t.correo_nuevo, c.correo AS correo_actual,
            t.expira_en > NOW() AS vigente, t.usado_en IS NOT NULL AS usado, c.fecha_desactivacion IS NOT NULL AS desactivada
     FROM token_cuenta t JOIN cuenta c ON c.id_cuenta = t.id_cuenta
     WHERE t.token_hash = ? AND t.tipo = 'cambiar_correo'
     FOR UPDATE OF t, c`,
    [tokenHash],
  );
  return filas[0] ?? null;
}

export async function usarTokenYCambiarCorreo(conexion: PoolConnection, idToken: number, idCuenta: number, correoNuevo: string) {
  await conexion.execute("UPDATE token_cuenta SET usado_en = NOW() WHERE id_token = ? AND usado_en IS NULL", [idToken]);
  await conexion.execute("UPDATE cuenta SET correo = ? WHERE id_cuenta = ?", [correoNuevo, idCuenta]);
}

// ---------------------------------------------------------------------
// Recuperar la contraseña (RN-80)
// ---------------------------------------------------------------------

// Como crearTokenCambioCorreo: pedir un enlace nuevo anula los anteriores sin usar (RN-80). Vence en
// minutos_recuperacion_contrasena (C-04), mucho menos que la verificación: este enlace da control de la cuenta.
export async function crearTokenRecuperacion(conexion: PoolConnection, idCuenta: number, tokenHash: string): Promise<number> {
  await conexion.execute(
    "DELETE FROM token_cuenta WHERE id_cuenta = ? AND tipo = 'recuperar_contrasena' AND usado_en IS NULL",
    [idCuenta],
  );
  await conexion.execute(
    `INSERT INTO token_cuenta (id_cuenta, token_hash, tipo, expira_en)
     SELECT ?, ?, 'recuperar_contrasena', NOW() + INTERVAL minutos_recuperacion_contrasena MINUTE FROM configuracion`,
    [idCuenta, tokenHash],
  );
  const [filas] = await conexion.execute<({ minutos_recuperacion_contrasena: number } & RowDataPacket)[]>(
    "SELECT minutos_recuperacion_contrasena FROM configuracion",
  );
  return filas[0].minutos_recuperacion_contrasena;
}

type FilaTokenRecuperacion = { id_token: number; id_cuenta: number; vigente: number; usado: number; desactivada: number } & RowDataPacket;

const SQL_TOKEN_RECUPERACION = `
  SELECT t.id_token, t.id_cuenta, t.expira_en > NOW() AS vigente, t.usado_en IS NOT NULL AS usado,
         c.fecha_desactivacion IS NOT NULL AS desactivada
  FROM token_cuenta t JOIN cuenta c ON c.id_cuenta = t.id_cuenta
  WHERE t.token_hash = ? AND t.tipo = 'recuperar_contrasena'`;

// Sin candado: una mirada previa para no gastar scrypt (~300 ms) en enlaces que no sirven. La que manda es la de abajo.
export async function consultarTokenRecuperacion(tokenHash: string) {
  const [filas] = await pool.execute<FilaTokenRecuperacion[]>(SQL_TOKEN_RECUPERACION, [tokenHash]);
  return filas[0] ?? null;
}

export async function bloquearTokenRecuperacion(conexion: PoolConnection, tokenHash: string) {
  const [filas] = await conexion.execute<FilaTokenRecuperacion[]>(`${SQL_TOKEN_RECUPERACION} FOR UPDATE OF t, c`, [tokenHash]);
  return filas[0] ?? null;
}

// RN-80: contraseña nueva, token usado y TODAS las sesiones cerradas (a diferencia de RN-78, aquí no hay una sesión
// "propia" que conservar: quien recupera no tenía la contraseña, y alguien más podría tener una sesión abierta).
export async function usarTokenYRestablecer(conexion: PoolConnection, idToken: number, idCuenta: number, passwordHash: string) {
  await conexion.execute("UPDATE token_cuenta SET usado_en = NOW() WHERE id_token = ? AND usado_en IS NULL", [idToken]);
  await conexion.execute("UPDATE cuenta SET password_hash = ? WHERE id_cuenta = ?", [passwordHash, idCuenta]);
  await conexion.execute("DELETE FROM sesion WHERE id_cuenta = ?", [idCuenta]);
}
