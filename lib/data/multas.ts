import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

// SQL de multas y sus pagos (RN-66, RN-67, D-07). Todo se usa dentro de una transacción.

type Conexion = PoolConnection;

type FilaMulta = {
  id_multa: number;
  id_lector: number;
  id_cuenta_lector: number; // para comprobar que el pago en línea lo hace el dueño
  id_sede_prestamo: number;
  monto: number;
  estado: "pendiente" | "pagada" | "anulada";
  titulo: string;
} & RowDataPacket;

export async function bloquearMulta(conexion: Conexion, idMulta: number) {
  const [filas] = await conexion.execute<FilaMulta[]>(
    `SELECT m.id_multa, p.id_lector, lc.id_cuenta AS id_cuenta_lector, p.id_sede_prestamo, m.monto, m.estado, l.titulo
     FROM multa m
     JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
     JOIN lector lc ON lc.id_lector = p.id_lector
     JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     JOIN libro l ON l.id_libro = e.id_libro
     WHERE m.id_multa = ?
     FOR UPDATE OF m`,
    [idMulta],
  );
  return filas[0] ?? null;
}

// Candado (RN-23 aplicado a multas): solo una pendiente pasa a pagada.
export async function marcarMultaPagada(conexion: Conexion, idMulta: number): Promise<boolean> {
  const [r] = await conexion.execute<ResultSetHeader>(
    "UPDATE multa SET estado = 'pagada', fecha_pago = NOW() WHERE id_multa = ? AND estado = 'pendiente'",
    [idMulta],
  );
  return r.affectedRows === 1;
}

export async function anularMulta(conexion: Conexion, idMulta: number, idEmpleado: number, motivo: string): Promise<boolean> {
  const [r] = await conexion.execute<ResultSetHeader>(
    `UPDATE multa SET estado = 'anulada', fecha_anulacion = NOW(), id_empleado_anula = ?, motivo_anulacion = ?
     WHERE id_multa = ? AND estado = 'pendiente'`,
    [idEmpleado, motivo, idMulta],
  );
  return r.affectedRows === 1;
}

// RN-66 en mostrador: se cobra en el acto, con empleado y sede (lo exige el CHECK ck_pago_canal).
export async function insertarPagoEnMostrador(conexion: Conexion, idMulta: number, monto: number, idEmpleado: number, idSede: number) {
  await conexion.execute(
    `INSERT INTO pago (id_multa, monto, metodo, estado, id_empleado, id_sede, fecha_confirmacion)
     VALUES (?, ?, 'efectivo', 'pagado', ?, ?, NOW())`,
    [idMulta, monto, idEmpleado, idSede],
  );
}

// RN-66 en línea (D-07): un intento pendiente. Si ya hay uno pendiente para la multa, se reutiliza.
export async function obtenerOCrearPagoEnLinea(conexion: Conexion, idMulta: number, monto: number): Promise<number> {
  const [pendientes] = await conexion.execute<({ id_pago: number } & RowDataPacket)[]>(
    "SELECT id_pago FROM pago WHERE id_multa = ? AND estado = 'pendiente' ORDER BY id_pago DESC LIMIT 1 FOR UPDATE",
    [idMulta],
  );
  if (pendientes[0]) return pendientes[0].id_pago;
  const [r] = await conexion.execute<ResultSetHeader>(
    "INSERT INTO pago (id_multa, monto, metodo) VALUES (?, ?, 'simulado')",
    [idMulta, monto],
  );
  return r.insertId;
}

type FilaPago = {
  id_pago: number;
  id_multa: number | null;
  monto: number;
  estado: "pendiente" | "pagado" | "fallido" | "reembolsado";
  id_cuenta_lector: number | null;
  titulo: string | null;
} & RowDataPacket;

// Pago con su dueño (la cuenta del lector de la multa) para comprobar en el servidor quién lo confirma.
export async function obtenerPago(conexion: Conexion | null, idPago: number, bloquear = false) {
  const sql = `SELECT pg.id_pago, pg.id_multa, pg.monto, pg.estado, lc.id_cuenta AS id_cuenta_lector, l.titulo
     FROM pago pg
     LEFT JOIN multa m ON m.id_multa = pg.id_multa
     LEFT JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
     LEFT JOIN lector lc ON lc.id_lector = p.id_lector
     LEFT JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
     LEFT JOIN libro l ON l.id_libro = e.id_libro
     WHERE pg.id_pago = ?${bloquear ? " FOR UPDATE OF pg" : ""}`;
  const ejecutor = conexion ?? pool; // sin conexión: lectura suelta para mostrar la pasarela
  const [filas] = await ejecutor.execute<FilaPago[]>(sql, [idPago]);
  return filas[0] ?? null;
}

export async function cerrarPagoEnLinea(conexion: Conexion, idPago: number, estado: "pagado" | "fallido"): Promise<boolean> {
  const [r] = await conexion.execute<ResultSetHeader>(
    "UPDATE pago SET estado = ?, fecha_confirmacion = NOW() WHERE id_pago = ? AND estado = 'pendiente'",
    [estado, idPago],
  );
  return r.affectedRows === 1;
}
