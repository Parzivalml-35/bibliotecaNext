import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { Anotacion, ColorAnotacion, EstiloAnotacion, NotaLibre, Posicion } from "@/lib/lectura";
import type { FormatoDigital } from "@/lib/definitions";

// SQL de lo que el lector escribe y hace mientras lee (RN-85 a RN-88, bloque 6 del esquema). REGLA DE ESTE ARCHIVO:
// toda consulta lleva `id_lector = ?` con el lector de la SESIÓN (RN-87): una anotación o nota ajena no existe para
// nadie más. Quien llama decide el acceso vigente al título (lib/actions/lectura.ts); aquí solo se lee y se escribe.

export type LimitesDeLectura = {
  max_caracteres_nota: number;
  max_caracteres_cita: number;
  segundos_latido_lectura: number;
  minutos_pausa_lectura: number;
};

// C-04: los límites viven en configuracion (una sola fila).
export async function limitesDeLectura(): Promise<LimitesDeLectura> {
  const [filas] = await pool.execute<(LimitesDeLectura & RowDataPacket)[]>(
    `SELECT max_caracteres_nota, max_caracteres_cita, segundos_latido_lectura, minutos_pausa_lectura FROM configuracion`,
  );
  return filas[0];
}

// ---------------------------------------------------------------------
// Resaltados (RN-85)
// ---------------------------------------------------------------------


const COLUMNAS_ANOTACION = `id_anotacion, cfi, texto_citado, color, estilo, nota,
       DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') AS fecha_creacion`;

export async function listarAnotaciones(idLector: number, idLibro: number): Promise<Anotacion[]> {
  const [filas] = await pool.execute<(Anotacion & RowDataPacket)[]>(
    `SELECT ${COLUMNAS_ANOTACION} FROM anotacion WHERE id_lector = ? AND id_libro = ? ORDER BY id_anotacion`,
    [idLector, idLibro],
  );
  return filas;
}

// RN-85: un fragmento se marca una sola vez. INSERT … ON DUPLICATE KEY UPDATE: si ya existe (uq_anotacion_fragmento),
// se actualizan su color, su estilo y (solo si llega una) su nota, en la misma sentencia y sin carrera entre leer y
// escribir. LAST_INSERT_ID(id_anotacion) en la rama de actualización hace que insertId devuelva el id de la fila
// existente (truco documentado de MySQL), así quien llama recibe siempre el id correcto.
// `AS nueva`: alias de la fila que se intentó insertar (MySQL 8.0.19+). Reemplaza a VALUES(col), obsoleto desde 8.0.20.
export async function guardarAnotacion(
  idLector: number,
  idLibro: number,
  a: { cfi: string; texto_citado: string; color: ColorAnotacion; estilo: EstiloAnotacion; nota: string | null },
): Promise<number> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    `INSERT INTO anotacion (id_lector, id_libro, cfi, texto_citado, color, estilo, nota)
     VALUES (?, ?, ?, ?, ?, ?, ?) AS nueva
     ON DUPLICATE KEY UPDATE id_anotacion = LAST_INSERT_ID(anotacion.id_anotacion), color = nueva.color,
                             estilo = nueva.estilo, nota = COALESCE(nueva.nota, anotacion.nota), fecha_edicion = NOW()`,
    [idLector, idLibro, a.cfi, a.texto_citado, a.color, a.estilo, a.nota],
  );
  return resultado.insertId;
}

// El título de una anotación propia (para comprobar el acceso antes de editarla). null = no existe o no es suya.
export async function libroDeAnotacion(idLector: number, idAnotacion: number): Promise<{ id_libro: number; isbn: string } | null> {
  const [filas] = await pool.execute<({ id_libro: number; isbn: string } & RowDataPacket)[]>(
    `SELECT a.id_libro, l.isbn FROM anotacion a JOIN libro l ON l.id_libro = a.id_libro
     WHERE a.id_anotacion = ? AND a.id_lector = ?`,
    [idAnotacion, idLector],
  );
  return filas[0] ?? null;
}

export async function actualizarAnotacion(
  idLector: number,
  idAnotacion: number,
  c: { color: ColorAnotacion; estilo: EstiloAnotacion; nota: string | null },
): Promise<boolean> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    `UPDATE anotacion SET color = ?, estilo = ?, nota = ?, fecha_edicion = NOW() WHERE id_anotacion = ? AND id_lector = ?`,
    [c.color, c.estilo, c.nota, idAnotacion, idLector],
  );
  return resultado.affectedRows === 1;
}

export async function borrarAnotacion(idLector: number, idAnotacion: number): Promise<boolean> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    "DELETE FROM anotacion WHERE id_anotacion = ? AND id_lector = ?",
    [idAnotacion, idLector],
  );
  return resultado.affectedRows === 1;
}

// ---------------------------------------------------------------------
// Notas libres (RN-86)
// ---------------------------------------------------------------------

export async function listarNotasLibres(idLector: number, idLibro: number): Promise<NotaLibre[]> {
  const [filas] = await pool.execute<(NotaLibre & RowDataPacket)[]>(
    `SELECT id_nota_libre, texto, cfi, capitulo, DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') AS fecha_creacion,
            fecha_edicion IS NOT NULL AS editada
     FROM nota_libre WHERE id_lector = ? AND id_libro = ? ORDER BY id_nota_libre DESC`,
    [idLector, idLibro],
  );
  return filas;
}

export async function crearNotaLibre(
  idLector: number,
  idLibro: number,
  n: { texto: string; cfi: string | null; capitulo: string | null },
): Promise<number> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    "INSERT INTO nota_libre (id_lector, id_libro, texto, cfi, capitulo) VALUES (?, ?, ?, ?, ?)",
    [idLector, idLibro, n.texto, n.cfi, n.capitulo],
  );
  return resultado.insertId;
}

export async function libroDeNotaLibre(idLector: number, idNota: number): Promise<{ id_libro: number; isbn: string } | null> {
  const [filas] = await pool.execute<({ id_libro: number; isbn: string } & RowDataPacket)[]>(
    `SELECT n.id_libro, l.isbn FROM nota_libre n JOIN libro l ON l.id_libro = n.id_libro
     WHERE n.id_nota_libre = ? AND n.id_lector = ?`,
    [idNota, idLector],
  );
  return filas[0] ?? null;
}

export async function editarNotaLibre(idLector: number, idNota: number, texto: string): Promise<boolean> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    "UPDATE nota_libre SET texto = ?, fecha_edicion = NOW() WHERE id_nota_libre = ? AND id_lector = ?",
    [texto, idNota, idLector],
  );
  return resultado.affectedRows === 1;
}

export async function borrarNotaLibre(idLector: number, idNota: number): Promise<boolean> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    "DELETE FROM nota_libre WHERE id_nota_libre = ? AND id_lector = ?",
    [idNota, idLector],
  );
  return resultado.affectedRows === 1;
}

// ---------------------------------------------------------------------
// Historial y posición (RN-88)
// ---------------------------------------------------------------------

export async function obtenerPosicion(idLector: number, idLibro: number, formato: FormatoDigital): Promise<Posicion | null> {
  const [filas] = await pool.execute<(Posicion & RowDataPacket)[]>(
    "SELECT cfi, pagina, fraccion FROM posicion_lectura WHERE id_lector = ? AND id_libro = ? AND formato = ?",
    [idLector, idLibro, formato],
  );
  // DECIMAL llega como texto desde mysql2 (para no perder precisión): se convierte aquí.
  return filas[0] ? { ...filas[0], fraccion: Number(filas[0].fraccion) } : null;
}

// RN-88: un latido del visor. En una transacción:
//  1. Busca la última sesión de este lector y título cuyo último aviso sea más reciente que la pausa, y la BLOQUEA
//     (FOR UPDATE): dos latidos simultáneos (dos pestañas) no extienden y crean a la vez.
//  2. Si existe, la extiende (último aviso = ahora, avance final = el de este aviso); si no, crea una nueva.
//  3. Guarda la posición del formato (INSERT … ON DUPLICATE KEY UPDATE sobre la PK lector-libro-formato).
// NOW() - INTERVAL ? MINUTE lo calcula MySQL: el reloj de la BD manda, no el del navegador.
export async function registrarLatido(
  conexion: PoolConnection,
  idLector: number,
  idLibro: number,
  formato: FormatoDigital,
  posicion: Posicion,
  minutosPausa: number,
): Promise<"extendida" | "nueva"> {
  const [abiertas] = await conexion.execute<({ id_sesion_lectura: number } & RowDataPacket)[]>(
    `SELECT id_sesion_lectura FROM sesion_lectura
     WHERE id_lector = ? AND id_libro = ? AND formato = ? AND ultimo_aviso > NOW() - INTERVAL ? MINUTE
     ORDER BY ultimo_aviso DESC LIMIT 1 FOR UPDATE`,
    [idLector, idLibro, formato, minutosPausa],
  );
  let resultado: "extendida" | "nueva";
  if (abiertas[0]) {
    await conexion.execute(
      "UPDATE sesion_lectura SET ultimo_aviso = NOW(), progreso_final = ? WHERE id_sesion_lectura = ?",
      [posicion.fraccion, abiertas[0].id_sesion_lectura],
    );
    resultado = "extendida";
  } else {
    await conexion.execute(
      `INSERT INTO sesion_lectura (id_lector, id_libro, formato, progreso_inicial, progreso_final) VALUES (?, ?, ?, ?, ?)`,
      [idLector, idLibro, formato, posicion.fraccion, posicion.fraccion],
    );
    resultado = "nueva";
  }
  await conexion.execute(
    `INSERT INTO posicion_lectura (id_lector, id_libro, formato, cfi, pagina, fraccion) VALUES (?, ?, ?, ?, ?, ?) AS nueva
     ON DUPLICATE KEY UPDATE cfi = nueva.cfi, pagina = nueva.pagina, fraccion = nueva.fraccion, fecha_actualizacion = NOW()`,
    [idLector, idLibro, formato, posicion.cfi, posicion.pagina, posicion.fraccion],
  );
  return resultado;
}
