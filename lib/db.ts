import "server-only";
import mysql, { type Pool } from "mysql2/promise";

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
