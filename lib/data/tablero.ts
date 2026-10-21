import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

// Indicadores del tablero (RN-33: reportes del coordinador de su sede; el administrador, de toda la red).
// Cada consulta recibe idSede o null. El filtro "(? IS NULL OR columna = ?)" va siempre con parámetros:
// con null no filtra; con un número, solo esa sede.

export type Indicadores = {
  prestamos_abiertos: number;
  prestamos_vencidos: number;
  multas_pendientes: number;
  monto_multas_pendientes: number;
  reservas_en_cola: number;
  reservas_asignadas: number;
  por_ubicar: number;
  candidatos_perdido: number;
};

export async function obtenerIndicadores(idSede: number | null): Promise<Indicadores> {
  const [filas] = await pool.execute<(Indicadores & RowDataPacket)[]>(
    `SELECT
       (SELECT COUNT(*) FROM prestamo_fisico p JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
        WHERE p.fecha_devolucion IS NULL AND e.estado <> 'perdido' AND (? IS NULL OR p.id_sede_prestamo = ?)) AS prestamos_abiertos,
       (SELECT COUNT(*) FROM prestamo_fisico p JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar
        WHERE p.fecha_devolucion IS NULL AND e.estado <> 'perdido' AND p.fecha_vencimiento < CURDATE()
          AND (? IS NULL OR p.id_sede_prestamo = ?)) AS prestamos_vencidos,
       (SELECT COUNT(*) FROM multa m JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
        WHERE m.estado = 'pendiente' AND (? IS NULL OR p.id_sede_prestamo = ?)) AS multas_pendientes,
       (SELECT COALESCE(SUM(m.monto), 0) FROM multa m JOIN prestamo_fisico p ON p.id_prestamo = m.id_prestamo
        WHERE m.estado = 'pendiente' AND (? IS NULL OR p.id_sede_prestamo = ?)) AS monto_multas_pendientes,
       (SELECT COUNT(*) FROM reserva_fisica r WHERE r.estado = 'activa' AND (? IS NULL OR r.id_sede = ?)) AS reservas_en_cola,
       (SELECT COUNT(*) FROM reserva_fisica r WHERE r.estado = 'asignada' AND (? IS NULL OR r.id_sede = ?)) AS reservas_asignadas,
       (SELECT COUNT(*) FROM ejemplar e WHERE e.estado = 'por_ubicar' AND (? IS NULL OR e.id_sede = ?)) AS por_ubicar,
       (SELECT COUNT(*) FROM prestamo_fisico p JOIN ejemplar e ON e.id_ejemplar = p.id_ejemplar CROSS JOIN configuracion cf
        WHERE p.fecha_devolucion IS NULL AND e.estado = 'prestado'
          AND DATEDIFF(CURDATE(), p.fecha_vencimiento) > cf.dias_atraso_perdido
          AND (? IS NULL OR p.id_sede_prestamo = ?)) AS candidatos_perdido`,
    Array(16).fill(idSede),
  );
  const f = filas[0];
  return { ...f, monto_multas_pendientes: Number(f.monto_multas_pendientes) };
}

export type Incoherencia = { codigo_barras: string; sede: string; guardado: string; deducido: string };

// RN-24: consulta detectora (db/consultas.sql, consulta 12). Debe devolver 0 filas.
export async function obtenerIncoherencias(idSede: number | null): Promise<Incoherencia[]> {
  const [filas] = await pool.execute<(Incoherencia & RowDataPacket)[]>(
    `SELECT codigo_barras, sede, guardado, deducido
     FROM (
       SELECT e.codigo_barras, sd.nombre AS sede, e.id_sede, e.estado AS guardado,
         CASE
           WHEN e.estado IN ('en_reparacion', 'perdido', 'de_baja') THEN e.estado
           WHEN EXISTS (SELECT 1 FROM prestamo_fisico p WHERE p.id_ejemplar = e.id_ejemplar AND p.fecha_devolucion IS NULL) THEN 'prestado'
           WHEN EXISTS (SELECT 1 FROM reserva_fisica r WHERE r.id_ejemplar = e.id_ejemplar AND r.estado = 'asignada') THEN 'apartado'
           WHEN EXISTS (SELECT 1 FROM traslado_ejemplar te JOIN traslado t ON t.id_traslado = te.id_traslado
                        WHERE te.id_ejemplar = e.id_ejemplar AND te.estado = 'incluido' AND t.estado = 'en_transito') THEN 'en_transito'
           WHEN e.id_ubicacion IS NULL THEN 'por_ubicar'
           ELSE 'disponible'
         END AS deducido
       FROM ejemplar e JOIN sede sd ON sd.id_sede = e.id_sede
     ) AS x
     WHERE guardado <> deducido AND (? IS NULL OR id_sede = ?)
     ORDER BY codigo_barras`,
    [idSede, idSede],
  );
  return filas;
}

export type TrasladoSugerido = { titulo: string; desde: string; hacia: string; en_cola: number; sugeridos: number };

// RN-14: db/consultas.sql, consulta 7. Con sede, los que salen de ella o llegan a ella.
export async function obtenerTrasladosSugeridos(idSede: number | null): Promise<TrasladoSugerido[]> {
  const [filas] = await pool.execute<(TrasladoSugerido & RowDataPacket)[]>(
    `WITH disponibles AS (
       SELECT id_libro, id_sede, COUNT(*) AS n FROM ejemplar WHERE estado = 'disponible' GROUP BY id_libro, id_sede
     ), demanda AS (
       SELECT id_libro, id_sede, COUNT(*) AS en_cola FROM reserva_fisica WHERE estado = 'activa' GROUP BY id_libro, id_sede
     )
     SELECT l.titulo, so.nombre AS desde, sd.nombre AS hacia, d.en_cola,
            LEAST(d.en_cola, o.n - cf.minimo_sobrante_traslado) AS sugeridos
     FROM demanda d
     JOIN libro l ON l.id_libro = d.id_libro
     JOIN sede sd ON sd.id_sede = d.id_sede
     CROSS JOIN configuracion cf
     JOIN disponibles o ON o.id_libro = d.id_libro AND o.id_sede <> d.id_sede AND o.n > cf.minimo_sobrante_traslado
     JOIN sede so ON so.id_sede = o.id_sede
     WHERE NOT EXISTS (SELECT 1 FROM disponibles x WHERE x.id_libro = d.id_libro AND x.id_sede = d.id_sede)
       AND (? IS NULL OR d.id_sede = ? OR o.id_sede = ?)
     ORDER BY l.titulo, o.n DESC`,
    [idSede, idSede, idSede],
  );
  return filas;
}
