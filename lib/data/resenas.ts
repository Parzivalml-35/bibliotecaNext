import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import { tuvoElLibro } from "@/lib/data/lectura";
import type { MotivoReporte } from "@/lib/resenas";

// SQL de las reseñas (RN-94) y sus reportes (RN-95), bloque 7. Lo PÚBLICO sale con el apodo de la cuenta (RN-92),
// nunca con el nombre del lector: ninguna consulta de este archivo que se muestre a otros lee lector.nombre.

export type ResumenResenas = {
  cantidad: number;
  promedio: number | null; // null sin reseñas visibles
  recomiendan: number; // cuántas dicen "sí"
};

export type ResenaPublica = {
  id_resena: number;
  apodo: string;
  estrellas: number;
  recomienda: boolean;
  texto: string | null;
  fecha: string; // dd/mm/yyyy
  editada: boolean;
  oculta: boolean; // solo puede llegar true en la propia (las ocultas ajenas no se listan)
  lo_leyo: boolean; // RN-94: "Lo leyó en la biblioteca", calculado con la regla de RN-86
  propia: boolean;
  reportada: boolean; // la reportó quien mira (para no ofrecer reportarla otra vez)
};

// Cuántas se listan en la ficha: las más recientes. Un número de la interfaz, no una regla.
const MAXIMO_EN_LA_FICHA = 50;

// El resumen cuenta solo las visibles (RN-95: una oculta no cuenta en el promedio).
export async function resumenDeResenas(idLibro: number): Promise<ResumenResenas> {
  const [[fila]] = await pool.execute<({ cantidad: number; promedio: string | null; recomiendan: string | null } & RowDataPacket)[]>(
    `SELECT COUNT(*) AS cantidad, AVG(estrellas) AS promedio, SUM(recomienda) AS recomiendan
     FROM resena WHERE id_libro = ? AND fecha_ocultada IS NULL`,
    [idLibro],
  );
  // AVG y SUM devuelven DECIMAL (texto en mysql2) y NULL sobre cero filas.
  return {
    cantidad: Number(fila.cantidad),
    promedio: fila.promedio === null ? null : Number(fila.promedio),
    recomiendan: Number(fila.recomiendan ?? 0),
  };
}

// Las reseñas del libro para quien mira (`idLector` null = sin sesión de lector). La propia va primero y se ve aunque
// esté oculta (su autor la ve marcada, RN-95); las ocultas ajenas no salen. La insignia usa tuvoElLibro("r.id_lector"):
// el mismo criterio que las notas (RN-86), fila por fila. `l` es el alias que el fragmento espera para el libro.
export async function resenasDeLibro(idLibro: number, idLector: number | null): Promise<ResenaPublica[]> {
  const quien = idLector ?? 0; // 0 no es ningún lector: "propia" y "reportada" salen falsas
  const [filas] = await pool.execute<
    (Omit<ResenaPublica, "recomienda" | "editada" | "oculta" | "lo_leyo" | "propia" | "reportada"> &
      Record<"recomienda" | "editada" | "oculta" | "lo_leyo" | "propia" | "reportada", 0 | 1> & RowDataPacket)[]
  >(
    `SELECT r.id_resena, c.apodo, r.estrellas, r.recomienda, r.texto,
            DATE_FORMAT(r.fecha_creacion, '%d/%m/%Y') AS fecha,
            r.fecha_edicion IS NOT NULL AS editada, r.fecha_ocultada IS NOT NULL AS oculta,
            ${tuvoElLibro("r.id_lector")} AS lo_leyo,
            r.id_lector = ? AS propia,
            EXISTS (SELECT 1 FROM reporte_resena rr WHERE rr.id_resena = r.id_resena AND rr.id_lector = ?) AS reportada
     FROM resena r
     JOIN libro l ON l.id_libro = r.id_libro
     JOIN lector le ON le.id_lector = r.id_lector
     JOIN cuenta c ON c.id_cuenta = le.id_cuenta
     WHERE r.id_libro = ? AND (r.fecha_ocultada IS NULL OR r.id_lector = ?)
     ORDER BY propia DESC, r.fecha_creacion DESC, r.id_resena DESC
     LIMIT ?`,
    [quien, quien, idLibro, quien, MAXIMO_EN_LA_FICHA],
  );
  return filas.map((f) => ({
    id_resena: f.id_resena,
    apodo: f.apodo,
    estrellas: f.estrellas,
    recomienda: f.recomienda === 1,
    texto: f.texto,
    fecha: f.fecha,
    editada: f.editada === 1,
    oculta: f.oculta === 1,
    lo_leyo: f.lo_leyo === 1,
    propia: f.propia === 1,
    reportada: f.reportada === 1,
  }));
}

export type MiResena = { estrellas: number; recomienda: boolean; texto: string | null; oculta: boolean };

// La reseña del lector sobre el libro (para llenar el formulario), o null.
export async function miResena(idLector: number, idLibro: number): Promise<MiResena | null> {
  const [filas] = await pool.execute<({ estrellas: number; recomienda: 0 | 1; texto: string | null; oculta: 0 | 1 } & RowDataPacket)[]>(
    `SELECT estrellas, recomienda, texto, fecha_ocultada IS NOT NULL AS oculta FROM resena WHERE id_lector = ? AND id_libro = ?`,
    [idLector, idLibro],
  );
  const f = filas[0];
  return f ? { estrellas: f.estrellas, recomienda: f.recomienda === 1, texto: f.texto, oculta: f.oculta === 1 } : null;
}

export async function maxCaracteresResena(): Promise<number> {
  const [[fila]] = await pool.execute<({ max_caracteres_resena: number } & RowDataPacket)[]>(
    "SELECT max_caracteres_resena FROM configuracion",
  );
  return fila.max_caracteres_resena;
}

// Crear o editar (una por libro y lector: el UNIQUE decide cuál). Editar marca fecha_edicion. NO toca fecha_ocultada:
// una reseña oculta sigue oculta aunque se edite (RN-95: no se vuelve a publicar editándola).
// `AS nueva`: la fila que se intentó insertar (MySQL 8.0.19+), como en las anotaciones de R10.
export async function guardarResenaDeLector(
  conexion: PoolConnection,
  idLector: number,
  idLibro: number,
  datos: { estrellas: number; recomienda: boolean; texto: string | null },
): Promise<void> {
  await conexion.execute(
    `INSERT INTO resena (id_lector, id_libro, estrellas, recomienda, texto) VALUES (?, ?, ?, ?, ?) AS nueva
     ON DUPLICATE KEY UPDATE estrellas = nueva.estrellas, recomienda = nueva.recomienda, texto = nueva.texto,
                             fecha_edicion = NOW()`,
    [idLector, idLibro, datos.estrellas, datos.recomienda, datos.texto],
  );
}

// Borrar la propia. Sus reportes se van con ella (ON DELETE CASCADE). true si había una.
export async function borrarResenaDeLector(idLector: number, idLibro: number): Promise<boolean> {
  const [r] = await pool.execute<ResultSetHeader>("DELETE FROM resena WHERE id_lector = ? AND id_libro = ?", [idLector, idLibro]);
  return r.affectedRows > 0;
}

// RN-95: reportar una reseña AJENA y VISIBLE. Devuelve el resultado para que la acción elija el mensaje; el UNIQUE
// (uq_reporte_resena_lector) frena el segundo reporte de la misma persona (quien llama trata ER_DUP_ENTRY).
export async function reportarResenaDeLector(
  conexion: PoolConnection,
  idLector: number,
  idResena: number,
  motivo: MotivoReporte,
  detalle: string | null,
): Promise<"ok" | "no_existe" | "propia"> {
  const [filas] = await conexion.execute<({ id_lector: number } & RowDataPacket)[]>(
    "SELECT id_lector FROM resena WHERE id_resena = ? AND fecha_ocultada IS NULL FOR SHARE",
    [idResena],
  );
  if (filas.length === 0) return "no_existe";
  if (filas[0].id_lector === idLector) return "propia";
  await conexion.execute(
    "INSERT INTO reporte_resena (id_resena, id_lector, motivo, detalle) VALUES (?, ?, ?, ?)",
    [idResena, idLector, motivo, detalle],
  );
  return "ok";
}
