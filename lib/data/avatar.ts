import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { EstiloAvatar } from "@/lib/avatar";

// SQL del avatar de una cuenta (RN-81; R7g sumará la foto de RN-82). Las columnas son de `cuenta`, no de `lector`:
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
