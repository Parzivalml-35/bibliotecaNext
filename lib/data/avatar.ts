import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { EstiloAvatar } from "@/lib/avatar";
import { pool } from "@/lib/db";

// SQL del avatar de una cuenta (RN-81 generado, RN-82 foto). Las columnas son de `cuenta`, no de `lector`:
// el avatar es igual para un lector y para un empleado.

// "Generar otro": MySQL pone una semilla nueva con la expresión DEFAULT de la columna (16 bytes aleatorios en
// base64url, ver db/init/01_schema.sql). Así la semilla nunca la elige ni la ve antes el navegador.
export async function nuevaSemillaDeAvatar(conexion: PoolConnection, idCuenta: number): Promise<void> {
  await conexion.execute("UPDATE cuenta SET avatar_semilla = DEFAULT WHERE id_cuenta = ?", [idCuenta]);
}

// Otro estilo con la MISMA semilla: el tipo EstiloAvatar obliga a quien llama a validar antes con esEstiloAvatar.
export async function cambiarEstiloDeAvatar(conexion: PoolConnection, idCuenta: number, estilo: EstiloAvatar): Promise<void> {
  await conexion.execute("UPDATE cuenta SET avatar_estilo = ? WHERE id_cuenta = ?", [estilo, idCuenta]);
}

// RN-82 + C-04: el tamaño máximo de la foto vive en los datos, no en el código.
export async function maxKbAvatar(): Promise<number> {
  const [filas] = await pool.execute<({ max_kb_avatar: number } & RowDataPacket)[]>(
    "SELECT max_kb_avatar FROM configuracion",
  );
  return filas[0].max_kb_avatar;
}

// ¿Alguna cuenta usa hoy esta foto? Para que un empleado vea solo fotos vigentes, no un archivo que quedó huérfano.
// uq_cuenta_avatar_clave (UNIQUE) es también un índice: la búsqueda no recorre la tabla.
export async function existeFotoDeAvatar(clave: string): Promise<boolean> {
  const [filas] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM cuenta WHERE avatar_clave = ? LIMIT 1", [clave]);
  return filas.length > 0;
}

// La foto actual de la cuenta, con la fila BLOQUEADA hasta el COMMIT. Si llegan dos subidas a la vez, la segunda espera
// aquí y luego lee la clave que dejó la primera: así cada una sabe qué archivo quedó sin usar y lo borra. Sin el
// candado, las dos leerían la misma clave vieja y la foto de la que pierde quedaría huérfana en el disco.
export async function bloquearFotoDeAvatar(conexion: PoolConnection, idCuenta: number): Promise<string | null> {
  const [filas] = await conexion.execute<({ avatar_clave: string | null } & RowDataPacket)[]>(
    "SELECT avatar_clave FROM cuenta WHERE id_cuenta = ? FOR UPDATE",
    [idCuenta],
  );
  return filas[0]?.avatar_clave ?? null;
}

// Pone la foto (clave nueva) o vuelve al avatar generado (null): estilo y semilla no se tocan, por eso "volver al
// generado" recupera el mismo dibujo de antes (modelo-datos.md, bloque 2).
export async function cambiarFotoDeAvatar(conexion: PoolConnection, idCuenta: number, clave: string | null): Promise<void> {
  await conexion.execute("UPDATE cuenta SET avatar_clave = ? WHERE id_cuenta = ?", [clave, idCuenta]);
}
