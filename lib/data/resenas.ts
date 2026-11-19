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

// ---------------------------------------------------------------------
// Moderación en el panel (RN-95)
// ---------------------------------------------------------------------
// La ve el personal con el permiso `lectores`. Aquí SÍ aparece el nombre real junto al apodo (RN-92: el personal lo ve,
// para las auditorías); estas consultas solo las usa el panel.

export type ReporteDeResena = { motivo: MotivoReporte; detalle: string | null; fecha: string; apodo: string };

export type ResenaAModerar = {
  id_resena: number;
  isbn: string;
  titulo: string;
  apodo: string;
  nombre: string; // nombre real del autor (solo el personal)
  estrellas: number;
  recomienda: boolean;
  texto: string | null;
  fecha: string;
  oculta_el: string | null; // fecha en que se ocultó (en la lista de ocultas)
  oculta_por: string | null; // nombre del empleado que la ocultó
  reportes: ReporteDeResena[]; // los pendientes (en la lista de reportadas)
};

type FilaModerar = Omit<ResenaAModerar, "recomienda" | "reportes"> & { recomienda: 0 | 1 } & RowDataPacket;

const COLUMNAS_MODERAR = `
  r.id_resena, li.isbn, li.titulo, c.apodo, CONCAT(le.nombre, ' ', le.apellido) AS nombre, r.estrellas, r.recomienda,
  r.texto, DATE_FORMAT(r.fecha_creacion, '%d/%m/%Y') AS fecha,
  DATE_FORMAT(r.fecha_ocultada, '%d/%m/%Y %H:%i') AS oculta_el,
  CONCAT(em.nombre, ' ', em.apellido) AS oculta_por`;
const DESDE_MODERAR = `
  FROM resena r
  JOIN libro li ON li.id_libro = r.id_libro
  JOIN lector le ON le.id_lector = r.id_lector
  JOIN cuenta c ON c.id_cuenta = le.id_cuenta
  LEFT JOIN empleado em ON em.id_empleado = r.id_empleado_oculta`;

const aModerar = (f: FilaModerar, reportes: ReporteDeResena[]): ResenaAModerar => ({
  id_resena: f.id_resena, isbn: f.isbn, titulo: f.titulo, apodo: f.apodo, nombre: f.nombre, estrellas: f.estrellas,
  recomienda: f.recomienda === 1, texto: f.texto, fecha: f.fecha, oculta_el: f.oculta_el, oculta_por: f.oculta_por, reportes,
});

// Reseñas VISIBLES con reportes pendientes, la más reportada primero. Dos consultas (reseñas y sus reportes) en lugar
// de una con GROUP_CONCAT: los textos de los reportes pueden traer cualquier carácter, y así llegan intactos.
export async function resenasReportadas(): Promise<ResenaAModerar[]> {
  const [filas] = await pool.execute<(FilaModerar & { pendientes: number })[]>(
    `SELECT ${COLUMNAS_MODERAR},
            (SELECT COUNT(*) FROM reporte_resena rr WHERE rr.id_resena = r.id_resena AND rr.estado = 'pendiente') AS pendientes
     ${DESDE_MODERAR}
     WHERE r.fecha_ocultada IS NULL
       AND EXISTS (SELECT 1 FROM reporte_resena rr WHERE rr.id_resena = r.id_resena AND rr.estado = 'pendiente')
     ORDER BY pendientes DESC, r.fecha_creacion`,
  );
  if (filas.length === 0) return [];
  // IN con tantos ? como reseñas: la lista sale de la consulta anterior (números), no del navegador.
  const ids = filas.map((f) => f.id_resena);
  const [reportes] = await pool.execute<(ReporteDeResena & { id_resena: number } & RowDataPacket)[]>(
    `SELECT rr.id_resena, rr.motivo, rr.detalle, DATE_FORMAT(rr.fecha, '%d/%m/%Y %H:%i') AS fecha, c.apodo
     FROM reporte_resena rr
     JOIN lector le ON le.id_lector = rr.id_lector
     JOIN cuenta c ON c.id_cuenta = le.id_cuenta
     WHERE rr.estado = 'pendiente' AND rr.id_resena IN (${ids.map(() => "?").join(", ")})
     ORDER BY rr.fecha`,
    ids,
  );
  return filas.map((f) =>
    aModerar(f, reportes.filter((r) => r.id_resena === f.id_resena).map(({ motivo, detalle, fecha, apodo }) => ({ motivo, detalle, fecha, apodo }))));
}

// Las ocultas, la más reciente primero (para volver a mostrarlas si fue un error).
export async function resenasOcultas(): Promise<ResenaAModerar[]> {
  const [filas] = await pool.execute<FilaModerar[]>(
    `SELECT ${COLUMNAS_MODERAR} ${DESDE_MODERAR} WHERE r.fecha_ocultada IS NOT NULL ORDER BY r.fecha_ocultada DESC LIMIT 50`,
  );
  return filas.map((f) => aModerar(f, []));
}

// Bloquea la reseña para moderarla (dos empleados a la vez: el segundo espera y ve el estado nuevo). Devuelve su ISBN
// (para revalidar la ficha) y si está oculta, o null si no existe.
export async function bloquearResena(conexion: PoolConnection, idResena: number) {
  const [filas] = await conexion.execute<({ isbn: string; oculta: 0 | 1 } & RowDataPacket)[]>(
    `SELECT li.isbn, r.fecha_ocultada IS NOT NULL AS oculta
     FROM resena r JOIN libro li ON li.id_libro = r.id_libro
     WHERE r.id_resena = ? FOR UPDATE OF r`,
    [idResena],
  );
  return filas[0] ? { isbn: filas[0].isbn, oculta: filas[0].oculta === 1 } : null;
}

// Resuelve TODOS los reportes pendientes de la reseña con el mismo resultado (RN-95: ocultar resuelve todos).
async function resolverReportes(conexion: PoolConnection, idResena: number, idEmpleado: number, estado: "ocultada" | "descartada") {
  const [r] = await conexion.execute<ResultSetHeader>(
    `UPDATE reporte_resena SET estado = ?, id_empleado = ?, fecha_resolucion = NOW()
     WHERE id_resena = ? AND estado = 'pendiente'`,
    [estado, idEmpleado, idResena],
  );
  return r.affectedRows;
}

export async function ocultarResena(conexion: PoolConnection, idResena: number, idEmpleado: number): Promise<number> {
  await conexion.execute(
    "UPDATE resena SET fecha_ocultada = NOW(), id_empleado_oculta = ? WHERE id_resena = ? AND fecha_ocultada IS NULL",
    [idEmpleado, idResena],
  );
  return resolverReportes(conexion, idResena, idEmpleado, "ocultada");
}

export async function descartarReportes(conexion: PoolConnection, idResena: number, idEmpleado: number): Promise<number> {
  return resolverReportes(conexion, idResena, idEmpleado, "descartada");
}

// Volver a mostrar: las dos columnas a NULL (ck_resena_oculta exige las dos o ninguna). Los reportes ya resueltos se
// quedan como estaban: son el registro de lo que pasó.
export async function mostrarResena(conexion: PoolConnection, idResena: number): Promise<void> {
  await conexion.execute("UPDATE resena SET fecha_ocultada = NULL, id_empleado_oculta = NULL WHERE id_resena = ?", [idResena]);
}
