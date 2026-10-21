import "server-only";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

// Lee una variable de entorno obligatoria. Si falta, falla con un mensaje claro
// (por ejemplo, en un equipo nuevo donde aún no se copió .env.example a .env).
function variableRequerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. ¿Copiaste .env.example a .env?`);
  }
  return valor;
}

function crearPool(): Pool {
  return mysql.createPool({
    host: variableRequerida("DB_HOST"),
    port: Number(variableRequerida("DB_PORT")),
    user: variableRequerida("MYSQL_USER"),
    password: variableRequerida("MYSQL_PASSWORD"),
    database: variableRequerida("MYSQL_DATABASE"),
    connectionLimit: 10,
    // DECIMAL llega como string por defecto (para no perder precisión); nuestros montos
    // en pesos caben sin problema en un number de JavaScript.
    decimalNumbers: true,
  });
}

// En desarrollo, Next.js vuelve a evaluar los módulos al guardar cambios; sin esto, cada
// recarga crearía un pool nuevo y dejaría conexiones abiertas. globalThis sobrevive a esas recargas.
const globalConPool = globalThis as unknown as { poolBiblioteca?: Pool };

export const pool: Pool = globalConPool.poolBiblioteca ?? crearPool();

if (process.env.NODE_ENV !== "production") {
  globalConPool.poolBiblioteca = pool;
}

// Ejecuta `trabajo` dentro de una transacción con UNA conexión del pool (una transacción vive en una
// conexión: con pool.execute() cada sentencia podría ir por una conexión distinta). Si `trabajo` lanza,
// se deshace todo (ROLLBACK) y el error sigue su camino; si termina bien, COMMIT. Siempre devuelve la
// conexión al pool. RN-23, RN-37, RN-56: toda operación que cambia el estado de un ejemplar va aquí.
export async function enTransaccion<T>(trabajo: (conexion: PoolConnection) => Promise<T>): Promise<T> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
