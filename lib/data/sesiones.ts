import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { RolEmpleado } from "@/lib/definitions";

// SQL de cuentas y sesiones (RN-31, RN-63, RN-64). La lógica de cookies y tokens está en lib/sesion.ts.

type FilaCuentaLogin = {
  id_cuenta: number;
  password_hash: string;
  desactivada: number; // 1/0: MySQL devuelve los booleanos como números
  es_empleado: number; // tiene perfil de empleado activo: decide si al entrar va al panel
} & RowDataPacket;

export async function buscarCuentaPorCorreo(correo: string) {
  const [filas] = await pool.execute<FilaCuentaLogin[]>(
    `SELECT c.id_cuenta, c.password_hash, c.fecha_desactivacion IS NOT NULL AS desactivada,
            EXISTS (SELECT 1 FROM empleado e WHERE e.id_cuenta = c.id_cuenta AND e.activo) AS es_empleado
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
} & RowDataPacket;

// RN-64 en una sola consulta: la sesión existe, no venció y la cuenta no está desactivada. El empleado
// llega por LEFT JOIN solo si está activo: una cuenta sin empleado activo sigue siendo una sesión válida
// (un lector), pero no entra al panel.
export async function buscarSesionVigente(tokenHash: string) {
  const [filas] = await pool.execute<FilaSesion[]>(
    `SELECT c.id_cuenta, c.correo, e.id_empleado, e.nombre, e.apellido, e.rol, e.id_sede, sd.nombre AS sede
     FROM sesion s
     JOIN cuenta c ON c.id_cuenta = s.id_cuenta
     LEFT JOIN empleado e ON e.id_cuenta = c.id_cuenta AND e.activo
     LEFT JOIN sede sd ON sd.id_sede = e.id_sede
     WHERE s.token_hash = ? AND s.expira_en > NOW() AND c.fecha_desactivacion IS NULL`,
    [tokenHash],
  );
  return filas[0] ?? null;
}

export async function borrarSesion(tokenHash: string): Promise<boolean> {
  const [resultado] = await pool.execute<ResultSetHeader>("DELETE FROM sesion WHERE token_hash = ?", [tokenHash]);
  return resultado.affectedRows > 0;
}
