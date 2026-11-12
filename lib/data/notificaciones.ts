import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cache } from "react";
import { pool } from "@/lib/db";

// SQL de las notificaciones (RN-91, bloque 7). REGLA DE ESTE ARCHIVO: toda consulta lleva `id_cuenta = ?` con la cuenta
// de la SESIÓN (RN-35): una notificación ajena no existe para nadie más. Son de la cuenta y no del lector (RN-31), así
// un empleado también podrá recibirlas.
//
// Vigente = no vencida (`fecha_vencimiento > NOW()`). Una vencida no se borra: deja de mostrarse.

export type TipoNotificacion = "encuesta";

export type Notificacion = {
  id_notificacion: number;
  tipo: TipoNotificacion;
  texto: string;
  enlace: string;
  fecha: string; // dd/mm/yyyy HH:MM, ya formateada en MySQL (como las notas de R10)
  leida: boolean;
};

// Cuántas se muestran en la campana: las más recientes. Un número de la interfaz, no una regla de negocio.
const MAXIMO_EN_LA_CAMPANA = 20;

// Lo que dibuja la campana: las vigentes más recientes y cuántas no se leyeron (puede haber más de las que se listan).
// cache(): si dos componentes de la misma petición la piden, la consulta corre una sola vez.
export const notificacionesDeCuenta = cache(async (idCuenta: number) => {
  const [[filas], [[conteo]]] = await Promise.all([
    pool.execute<(Omit<Notificacion, "leida"> & { leida: 0 | 1 } & RowDataPacket)[]>(
      `SELECT id_notificacion, tipo, texto, enlace, DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') AS fecha,
              fecha_lectura IS NOT NULL AS leida
       FROM notificacion
       WHERE id_cuenta = ? AND fecha_vencimiento > NOW()
       ORDER BY fecha_creacion DESC, id_notificacion DESC
       LIMIT ?`,
      [idCuenta, MAXIMO_EN_LA_CAMPANA],
    ),
    pool.execute<({ no_leidas: number } & RowDataPacket)[]>(
      `SELECT COUNT(*) AS no_leidas FROM notificacion
       WHERE id_cuenta = ? AND fecha_vencimiento > NOW() AND fecha_lectura IS NULL`,
      [idCuenta],
    ),
  ]);
  // MySQL devuelve la comparación como 0/1: se pasa a boolean aquí para que el componente no lo tenga que saber.
  return {
    lista: filas.map((f): Notificacion => ({ ...f, leida: f.leida === 1 })),
    noLeidas: Number(conteo.no_leidas),
  };
});

// Abrir una notificación: se marca leída (si no lo estaba) y se devuelve su enlace. null = no existe, es de otra cuenta
// o ya venció. COALESCE: abrirla otra vez no cambia la fecha en que se leyó por primera vez.
export async function abrirNotificacionDeCuenta(idCuenta: number, idNotificacion: number): Promise<string | null> {
  const [filas] = await pool.execute<({ enlace: string } & RowDataPacket)[]>(
    `SELECT enlace FROM notificacion WHERE id_notificacion = ? AND id_cuenta = ? AND fecha_vencimiento > NOW()`,
    [idNotificacion, idCuenta],
  );
  if (filas.length === 0) return null;
  await pool.execute(
    `UPDATE notificacion SET fecha_lectura = COALESCE(fecha_lectura, NOW()) WHERE id_notificacion = ? AND id_cuenta = ?`,
    [idNotificacion, idCuenta],
  );
  return filas[0].enlace;
}

// "Marcar todas como leídas": solo las vigentes y sin leer de esta cuenta.
export async function marcarTodasLeidasDeCuenta(idCuenta: number): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    `UPDATE notificacion SET fecha_lectura = NOW()
     WHERE id_cuenta = ? AND fecha_vencimiento > NOW() AND fecha_lectura IS NULL`,
    [idCuenta],
  );
  return r.affectedRows;
}

// Crear una notificación. Recibe la conexión de quien llama: la encuesta (R11-D) nace DENTRO de la transacción de una
// devolución, así si la devolución se deshace, el aviso también. El vencimiento sale de configuracion (C-04, RN-91):
// INSERT … SELECT toma el valor de la única fila en la misma sentencia.
// `enlace` ya validado por quien llama (rutaInterna); la BD lo vuelve a comprobar (ck_notificacion_enlace).
export async function crearNotificacion(
  conexion: PoolConnection,
  datos: { idCuenta: number; tipo: TipoNotificacion; texto: string; enlace: string; idLibro: number | null },
): Promise<void> {
  await conexion.execute(
    `INSERT INTO notificacion (id_cuenta, tipo, texto, enlace, id_libro, fecha_vencimiento)
     SELECT ?, ?, ?, ?, ?, NOW() + INTERVAL dias_vencimiento_notificacion DAY FROM configuracion`,
    [datos.idCuenta, datos.tipo, datos.texto, datos.enlace, datos.idLibro],
  );
}
