// Asigna la contraseña DEV_PASSWORD del .env a las cuentas de prueba del seed (correos @example.com).
// Uso: pnpm db:claves-dev   (también después de reconstruir la BD con docker compose down -v)
// La contraseña nunca entra al repo: vive solo en el .env de cada equipo.
import mysql, { type RowDataPacket } from "mysql2/promise";
import { hashearContrasena } from "../lib/contrasenas.ts";

const contrasena = process.env.DEV_PASSWORD;
if (!contrasena || contrasena.length < 12) {
  console.error("Falta DEV_PASSWORD en .env (mínimo 12 caracteres). Ver .env.example.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production") {
  console.error("Este script es solo para desarrollo.");
  process.exit(1);
}

// No usa lib/db.ts: ese módulo importa "server-only", que solo funciona dentro de Next.
const conexion = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

try {
  // Solo cuentas del dominio reservado de ejemplos: nunca toca una cuenta real.
  const [cuentas] = await conexion.execute<RowDataPacket[]>(
    "SELECT id_cuenta, correo FROM cuenta WHERE correo LIKE '%@example.com' ORDER BY id_cuenta",
  );

  for (const cuenta of cuentas) {
    // Un hash por cuenta: cada una lleva su propia sal, así dos cuentas con la misma contraseña
    // tienen hashes distintos.
    const hash = await hashearContrasena(contrasena);
    await conexion.execute("UPDATE cuenta SET password_hash = ? WHERE id_cuenta = ?", [hash, cuenta.id_cuenta]);
    console.log(`  ✓ ${cuenta.correo}`);
  }
  console.log(`Contraseña de desarrollo asignada a ${cuentas.length} cuentas.`);
} finally {
  await conexion.end();
}
