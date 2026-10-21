import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

// RN-73: bitácora de intentos de inicio de sesión y registro, y los conteos que deciden si se rechaza.

export async function anotarIntento(tipo: "login" | "registro", correo: string, ip: string, exito: boolean) {
  // Purga perezosa: lo de más de un día ya no sirve para ninguna ventana (usa idx_intento_fecha).
  await pool.execute("DELETE FROM intento_acceso WHERE fecha < NOW() - INTERVAL 1 DAY");
  await pool.execute("INSERT INTO intento_acceso (tipo, correo, ip, exito) VALUES (?, ?, ?, ?)", [tipo, correo, ip, exito]);
}

type FilaLimite = { excedido: number } & RowDataPacket;

// ¿Superó el límite de fallos de inicio de sesión? Por correo (sin contar los fallos anteriores a su último
// acceso correcto) o por IP. La ventana y los máximos salen de configuracion (C-04).
export async function loginBloqueado(correo: string, ip: string): Promise<boolean> {
  const [filas] = await pool.execute<FilaLimite[]>(
    `SELECT
       (SELECT COUNT(*) FROM intento_acceso i
        WHERE i.tipo = 'login' AND i.correo = ? AND NOT i.exito
          AND i.fecha > NOW() - INTERVAL cf.minutos_ventana_intentos MINUTE
          AND i.fecha > COALESCE((SELECT MAX(x.fecha) FROM intento_acceso x
                                  WHERE x.tipo = 'login' AND x.correo = ? AND x.exito), '1000-01-01')
       ) >= cf.max_fallos_por_correo
       OR
       (SELECT COUNT(*) FROM intento_acceso i
        WHERE i.tipo = 'login' AND i.ip = ? AND NOT i.exito
          AND i.fecha > NOW() - INTERVAL cf.minutos_ventana_intentos MINUTE
       ) >= cf.max_fallos_por_ip AS excedido
     FROM configuracion cf`,
    [correo, correo, ip],
  );
  return filas[0].excedido === 1;
}

export async function registroBloqueado(ip: string): Promise<boolean> {
  const [filas] = await pool.execute<FilaLimite[]>(
    `SELECT (SELECT COUNT(*) FROM intento_acceso i
             WHERE i.tipo = 'registro' AND i.ip = ? AND i.fecha > NOW() - INTERVAL cf.minutos_ventana_intentos MINUTE
            ) >= cf.max_registros_por_ip AS excedido
     FROM configuracion cf`,
    [ip],
  );
  return filas[0].excedido === 1;
}
