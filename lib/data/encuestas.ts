import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

// RN-93: la encuesta al terminar un libro. No es una tabla propia: es una notificación de tipo `encuesta` (RN-91) que
// lleva a la tarjeta "Tu opinión" del libro en "Mis lecturas" (#encuesta), donde se escribe la reseña (RN-94) y, en
// un libro de papel, la página alcanzada (RN-90).
//
// "No repetir" (RN-93): no se envía si el lector ya reseñó el libro ni si tiene una encuesta de ese libro sin vencer.

// El destino de la encuesta: una ruta interna (ck_notificacion_enlace). El ISBN sale de la BD, no del navegador.
export const enlaceDeEncuesta = (isbn: string) => `/cuenta/lecturas/${isbn}#encuesta`;
const textoDeEncuesta = (titulo: string) => `¿Qué te pareció «${titulo}»? Cuéntanos en una reseña.`;

// Envía la encuesta si corresponde, dentro de la transacción de quien la dispara (una devolución, "Terminé de leer"):
// si esa operación se deshace, la encuesta también. Una sola sentencia INSERT … SELECT: las condiciones de "no repetir"
// van en el WHERE, así no hay un hueco entre consultar y escribir dentro de esta conexión.
// Devuelve el correo y el título si se creó (para el correo simulado, que quien llama envía después del COMMIT), o null.
export async function enviarEncuesta(
  conexion: PoolConnection,
  idLector: number,
  idLibro: number,
): Promise<{ correo: string; titulo: string } | null> {
  const [libros] = await conexion.execute<({ isbn: string; titulo: string } & RowDataPacket)[]>(
    "SELECT isbn, titulo FROM libro WHERE id_libro = ?",
    [idLibro],
  );
  if (libros.length === 0) return null;
  const { isbn, titulo } = libros[0];

  const [r] = await conexion.execute<ResultSetHeader>(
    `INSERT INTO notificacion (id_cuenta, tipo, texto, enlace, id_libro, fecha_vencimiento)
     SELECT l.id_cuenta, 'encuesta', ?, ?, ?, NOW() + INTERVAL cf.dias_vencimiento_notificacion DAY
     FROM lector l CROSS JOIN configuracion cf
     WHERE l.id_lector = ?
       AND NOT EXISTS (SELECT 1 FROM resena r WHERE r.id_lector = l.id_lector AND r.id_libro = ?)
       AND NOT EXISTS (SELECT 1 FROM notificacion n
                       WHERE n.id_cuenta = l.id_cuenta AND n.tipo = 'encuesta' AND n.id_libro = ?
                         AND n.fecha_vencimiento > NOW())`,
    [textoDeEncuesta(titulo), enlaceDeEncuesta(isbn), idLibro, idLector, idLibro, idLibro],
  );
  if (r.affectedRows === 0) return null;

  const [cuentas] = await conexion.execute<({ correo: string } & RowDataPacket)[]>(
    "SELECT c.correo FROM lector l JOIN cuenta c ON c.id_cuenta = l.id_cuenta WHERE l.id_lector = ?",
    [idLector],
  );
  return { correo: cuentas[0].correo, titulo };
}

// ---------------------------------------------------------------------
// Encuestas CALCULADAS: préstamos digitales que vencieron solos (RN-27)
// ---------------------------------------------------------------------
// Un préstamo digital vence sin que nadie haga nada: no hay un momento en que escribir la encuesta. Se calcula al
// mostrar las notificaciones (un GET no escribe, mismo criterio que el turno de la cola) y se guarda cuando el lector
// la abre. Cuenta como "ya enviada" cualquier encuesta de ese libro creada desde que empezó ese préstamo.
// Se muestran mientras no pasen `dias_vencimiento_notificacion` días desde el vencimiento (como una guardada).

export type EncuestaCalculada = {
  id_prestamo_digital: number;
  texto: string;
  enlace: string;
  fecha: string; // dd/mm/yyyy HH:MM del vencimiento
  marca: number; // segundos desde 1970, para ordenarla junto a las guardadas
};

const CONDICIONES_CALCULADA = `
  pd.fecha_devolucion IS NULL AND pd.fecha_fin <= NOW()
  AND pd.fecha_fin > NOW() - INTERVAL cf.dias_vencimiento_notificacion DAY
  AND NOT EXISTS (SELECT 1 FROM resena r WHERE r.id_lector = l.id_lector AND r.id_libro = li.id_libro)
  AND NOT EXISTS (SELECT 1 FROM notificacion n
                  WHERE n.id_cuenta = l.id_cuenta AND n.tipo = 'encuesta' AND n.id_libro = li.id_libro
                    AND n.fecha_creacion >= pd.fecha_inicio)`;

const DESDE_CALCULADA = `
  FROM prestamo_digital pd
  JOIN lector l ON l.id_lector = pd.id_lector
  JOIN licencia_digital ld ON ld.id_licencia = pd.id_licencia
  JOIN libro li ON li.id_libro = ld.id_libro
  CROSS JOIN configuracion cf`;

type FilaCalculada = {
  id_prestamo_digital: number;
  id_libro: number;
  id_cuenta: number;
  isbn: string;
  titulo: string;
  fecha: string;
  marca: number;
} & RowDataPacket;

export async function encuestasCalculadas(idCuenta: number): Promise<EncuestaCalculada[]> {
  const [filas] = await pool.execute<FilaCalculada[]>(
    `SELECT pd.id_prestamo_digital, li.isbn, li.titulo,
            DATE_FORMAT(pd.fecha_fin, '%d/%m/%Y %H:%i') AS fecha, UNIX_TIMESTAMP(pd.fecha_fin) AS marca
     ${DESDE_CALCULADA}
     WHERE l.id_cuenta = ? AND ${CONDICIONES_CALCULADA}`,
    [idCuenta],
  );
  // Si el mismo libro tuvo dos préstamos vencidos seguidos sin encuesta, una sola (la del más reciente).
  const porLibro = new Map<string, FilaCalculada>();
  for (const f of filas) if ((porLibro.get(f.isbn)?.marca ?? -1) < Number(f.marca)) porLibro.set(f.isbn, f);
  return [...porLibro.values()].map((f) => ({
    id_prestamo_digital: f.id_prestamo_digital,
    texto: textoDeEncuesta(f.titulo),
    enlace: enlaceDeEncuesta(f.isbn),
    fecha: f.fecha,
    marca: Number(f.marca),
  }));
}

// El lector abre una encuesta calculada: se guarda (ya leída) con las MISMAS condiciones, y se devuelve el enlace.
// null = el préstamo no es de esta cuenta, no venció, ya tiene encuesta o reseña. Así abrirla dos veces no la duplica.
export async function guardarEncuestaCalculada(conexion: PoolConnection, idCuenta: number, idPrestamo: number): Promise<string | null> {
  const [filas] = await conexion.execute<FilaCalculada[]>(
    `SELECT pd.id_prestamo_digital, li.id_libro, l.id_cuenta, li.isbn, li.titulo, '' AS fecha, 0 AS marca
     ${DESDE_CALCULADA}
     WHERE pd.id_prestamo_digital = ? AND l.id_cuenta = ? AND ${CONDICIONES_CALCULADA}
     FOR UPDATE OF pd`,
    [idPrestamo, idCuenta],
  );
  if (filas.length === 0) return null;
  const f = filas[0];
  await conexion.execute(
    `INSERT INTO notificacion (id_cuenta, tipo, texto, enlace, id_libro, fecha_lectura, fecha_vencimiento)
     SELECT ?, 'encuesta', ?, ?, ?, NOW(), NOW() + INTERVAL dias_vencimiento_notificacion DAY FROM configuracion`,
    [f.id_cuenta, textoDeEncuesta(f.titulo), enlaceDeEncuesta(f.isbn), f.id_libro],
  );
  return enlaceDeEncuesta(f.isbn);
}

// ---------------------------------------------------------------------
// "Terminé de leer" (RN-93)
// ---------------------------------------------------------------------

// La fecha (dd/mm/yyyy) en que lo marcó, o null.
export async function fechaTerminado(idLector: number, idLibro: number): Promise<string | null> {
  const [filas] = await pool.execute<({ fecha: string } & RowDataPacket)[]>(
    "SELECT DATE_FORMAT(fecha, '%d/%m/%Y') AS fecha FROM lectura_terminada WHERE id_lector = ? AND id_libro = ?",
    [idLector, idLibro],
  );
  return filas[0]?.fecha ?? null;
}

// Marcar dos veces no cambia la fecha de la primera (ON DUPLICATE KEY UPDATE sin cambios). No devuelve si era nueva:
// affectedRows no lo dice con seguridad (con la opción FOUND_ROWS del cliente, "ya estaba" también cuenta 1), y no hace
// falta: enviarEncuesta ya evita repetirse con sus propias condiciones.
export async function marcarTerminado(conexion: PoolConnection, idLector: number, idLibro: number): Promise<void> {
  await conexion.execute(
    "INSERT INTO lectura_terminada (id_lector, id_libro) VALUES (?, ?) ON DUPLICATE KEY UPDATE fecha = fecha",
    [idLector, idLibro],
  );
}

export async function desmarcarTerminado(idLector: number, idLibro: number): Promise<void> {
  await pool.execute("DELETE FROM lectura_terminada WHERE id_lector = ? AND id_libro = ?", [idLector, idLibro]);
}
