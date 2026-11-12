import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cache } from "react";
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
  minutos_inactividad_lectura: number;
};

// C-04: los límites viven en configuracion (una sola fila).
export async function limitesDeLectura(): Promise<LimitesDeLectura> {
  const [filas] = await pool.execute<(LimitesDeLectura & RowDataPacket)[]>(
    `SELECT max_caracteres_nota, max_caracteres_cita, segundos_latido_lectura, minutos_pausa_lectura,
            minutos_inactividad_lectura FROM configuracion`,
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

// RN-88: un latido del visor. `nueva`: el visor vuelve de una inactividad (minutos_inactividad_lectura) y la sesión
// anterior ya terminó, aunque no haya pasado la pausa: se salta el paso 1 y se crea otra. En una transacción:
//  1. Busca la última sesión de este lector y título cuyo último aviso sea más reciente que la pausa, y la BLOQUEA
//     (FOR UPDATE): dos latidos simultáneos (dos pestañas) no extienden y crean a la vez.
//  2. Si existe, la extiende (último aviso = ahora, avance final = el de este aviso) y le SUMA el tiempo desde el aviso
//     anterior, con tope `topeSegundos` (un hueco largo cuenta como mucho eso); si no, crea una nueva (0 s).
//  3. Guarda la posición del formato (INSERT … ON DUPLICATE KEY UPDATE sobre la PK lector-libro-formato).
// NOW() - INTERVAL ? MINUTE lo calcula MySQL: el reloj de la BD manda, no el del navegador.
export async function registrarLatido(
  conexion: PoolConnection,
  idLector: number,
  idLibro: number,
  formato: FormatoDigital,
  posicion: Posicion,
  minutosPausa: number,
  topeSegundos: number,
  nueva: boolean,
): Promise<"extendida" | "nueva"> {
  const [abiertas] = nueva ? [[]] : await conexion.execute<({ id_sesion_lectura: number } & RowDataPacket)[]>(
    `SELECT id_sesion_lectura FROM sesion_lectura
     WHERE id_lector = ? AND id_libro = ? AND formato = ? AND ultimo_aviso > NOW() - INTERVAL ? MINUTE
     ORDER BY ultimo_aviso DESC LIMIT 1 FOR UPDATE`,
    [idLector, idLibro, formato, minutosPausa],
  );
  let resultado: "extendida" | "nueva";
  if (abiertas[0]) {
    await conexion.execute(
      // El ORDEN del SET importa: MySQL asigna de izquierda a derecha en un UPDATE de una tabla (manual de UPDATE), así
      // que segundos_activos se calcula con el ultimo_aviso ANTERIOR y recién después ultimo_aviso pasa a NOW().
      // LEAST: el menor de los dos (el hueco real o el tope).
      `UPDATE sesion_lectura
       SET segundos_activos = segundos_activos + LEAST(TIMESTAMPDIFF(SECOND, ultimo_aviso, NOW()), ?),
           ultimo_aviso = NOW(), progreso_final = ?
       WHERE id_sesion_lectura = ?`,
      [topeSegundos, posicion.fraccion, abiertas[0].id_sesion_lectura],
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

// ---------------------------------------------------------------------
// "Mis lecturas" (R10-F, RN-87): todo lo del lector, agrupado por libro
// ---------------------------------------------------------------------

// RN-86, RN-89: "el lector TUVO este libro": un préstamo físico (en curso o devuelto), un préstamo digital (vigente o
// terminado), una compra digital (acceso_digital) o una compra física entregada. Una reserva sola NO cuenta.
// Fragmento SQL reutilizable: espera el libro como `l.id_libro` y lleva CUATRO `?`, todos el id del lector.
const TUVO_EL_LIBRO = `(
  EXISTS (SELECT 1 FROM prestamo_fisico pf JOIN ejemplar ej ON ej.id_ejemplar = pf.id_ejemplar
          WHERE pf.id_lector = ? AND ej.id_libro = l.id_libro)
  OR EXISTS (SELECT 1 FROM prestamo_digital pd JOIN licencia_digital ld ON ld.id_licencia = pd.id_licencia
             WHERE pd.id_lector = ? AND ld.id_libro = l.id_libro)
  OR EXISTS (SELECT 1 FROM acceso_digital ad WHERE ad.id_lector = ? AND ad.id_libro = l.id_libro)
  OR EXISTS (SELECT 1 FROM pedido pe JOIN pedido_detalle dt ON dt.id_pedido = pe.id_pedido
             JOIN producto pr ON pr.id_producto = dt.id_producto
             WHERE pe.id_lector = ? AND pe.estado = 'entregado' AND pr.tipo = 'fisico' AND pr.id_libro = l.id_libro)
)`;
const lectorCuatroVeces = (idLector: number) => [idLector, idLector, idLector, idLector];

// El id del libro (por ISBN) si el lector lo tuvo; null si no (o si no existe: la respuesta es la misma).
export async function libroQueTuvo(idLector: number, isbn: string): Promise<number | null> {
  const [filas] = await pool.execute<({ id_libro: number } & RowDataPacket)[]>(
    `SELECT l.id_libro FROM libro l WHERE l.isbn = ? AND ${TUVO_EL_LIBRO}`,
    [isbn, ...lectorCuatroVeces(idLector)],
  );
  return filas[0]?.id_libro ?? null;
}
export async function lectorTuvoLibro(idLector: number, idLibro: number): Promise<boolean> {
  const [filas] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM libro l WHERE l.id_libro = ? AND ${TUVO_EL_LIBRO}`,
    [idLibro, ...lectorCuatroVeces(idLector)],
  );
  return filas.length > 0;
}

// Un libro de "Mis lecturas" (RN-89). avance_digital: la mayor fracción de sus formatos digitales (null si nunca lo
// abrió en línea). pagina_fisica: la mayor página informada en sus préstamos físicos (RN-90; null si no informó).
// paginas: del catálogo (null = sin dato: la página se muestra sin porcentaje). ultima: la actividad más reciente.
export type LibroLeido = {
  id_libro: number;
  isbn: string;
  titulo: string;
  autores: string | null;
  paginas: number | null;
  avance_digital: number | null;
  pagina_fisica: number | null;
  ultima: string; // "12/11/2026 09:05"
};

// La subconsulta `x` junta con UNION ALL una fila por cada cosa hecha con un libro (préstamos, compras, lecturas,
// notas…) con su fecha, y agrupa por libro: salen los libros SIN repetirse y con su fecha más reciente, para ordenar.
// Solo entran los que el lector TUVO (TUVO_EL_LIBRO): una nota huérfana de un libro que nunca tuvo no puede existir
// por las reglas, y una reserva sola no basta. El id del lector va en cada subconsulta: once veces en total.
// cache() de React: en una misma petición la piden el layout de "Mis lecturas" (la lista) y su página; la consulta
// corre una sola vez. No es un caché entre peticiones: cada visita lee la BD de nuevo.
export const listarLibrosLeidos = cache(async (idLector: number): Promise<LibroLeido[]> => {
  type Fila = Omit<LibroLeido, "avance_digital"> & { avance_digital: string | null } & RowDataPacket;
  const [filas] = await pool.execute<Fila[]>(
    `SELECT l.id_libro, l.isbn, l.titulo, l.paginas,
            (SELECT GROUP_CONCAT(CONCAT(a.nombre, ' ', a.apellido) ORDER BY a.apellido SEPARATOR ', ')
             FROM autor_libro al JOIN autor a USING (id_autor) WHERE al.id_libro = l.id_libro) AS autores,
            (SELECT MAX(p.fraccion) FROM posicion_lectura p WHERE p.id_lector = ? AND p.id_libro = l.id_libro) AS avance_digital,
            (SELECT MAX(af.pagina) FROM avance_fisico af JOIN prestamo_fisico pf ON pf.id_prestamo = af.id_prestamo
             JOIN ejemplar ej ON ej.id_ejemplar = pf.id_ejemplar
             WHERE pf.id_lector = ? AND ej.id_libro = l.id_libro) AS pagina_fisica,
            DATE_FORMAT(x.ultima, '%d/%m/%Y %H:%i') AS ultima
     FROM (
       SELECT id_libro, MAX(fecha) AS ultima FROM (
         SELECT ej.id_libro, COALESCE(pf.fecha_devolucion, pf.fecha_prestamo) AS fecha
           FROM prestamo_fisico pf JOIN ejemplar ej ON ej.id_ejemplar = pf.id_ejemplar WHERE pf.id_lector = ?
         UNION ALL SELECT ld.id_libro, pd.fecha_inicio
           FROM prestamo_digital pd JOIN licencia_digital ld ON ld.id_licencia = pd.id_licencia WHERE pd.id_lector = ?
         UNION ALL SELECT id_libro, fecha_otorgado FROM acceso_digital WHERE id_lector = ?
         UNION ALL SELECT pr.id_libro, pe.fecha_entrega
           FROM pedido pe JOIN pedido_detalle dt ON dt.id_pedido = pe.id_pedido
           JOIN producto pr ON pr.id_producto = dt.id_producto
           WHERE pe.id_lector = ? AND pe.estado = 'entregado' AND pr.tipo = 'fisico'
         UNION ALL SELECT id_libro, ultimo_aviso FROM sesion_lectura WHERE id_lector = ?
         UNION ALL SELECT id_libro, COALESCE(fecha_edicion, fecha_creacion) FROM anotacion WHERE id_lector = ?
         UNION ALL SELECT id_libro, COALESCE(fecha_edicion, fecha_creacion) FROM nota_libre WHERE id_lector = ?
       ) hechos
       GROUP BY id_libro
     ) x
     JOIN libro l ON l.id_libro = x.id_libro
     WHERE ${TUVO_EL_LIBRO}
     ORDER BY x.ultima DESC, l.titulo`,
    [idLector, idLector, idLector, idLector, idLector, idLector, idLector, idLector, idLector, ...lectorCuatroVeces(idLector)],
  );
  // DECIMAL llega como texto desde mysql2: se convierte aquí.
  return filas.map((f) => ({ ...f, avance_digital: f.avance_digital === null ? null : Number(f.avance_digital) }));
});

// ---- La historia del lector con UN libro (RN-89) ----

// Cada hecho, con sus fechas ya formateadas para mostrar y `orden` (la fecha sin formato, "2026-11-12 09:05:00") para
// ordenarlos juntos. Una unión discriminada por `tipo`: TypeScript sabe qué campos tiene cada uno.
export type HechoDelLibro = { orden: string; fecha: string } & (
  | { tipo: "reserva_fisica"; estado: string; sede: string; cierre: string | null }
  | { tipo: "prestamo_fisico"; id_prestamo: number; sede: string; vence: string; renovaciones: number;
      devuelto: string | null; sede_devolucion: string | null; pagina: number | null }
  | { tipo: "reserva_digital"; estado: string; cierre: string | null }
  | { tipo: "prestamo_digital"; fin: string; devuelto: string | null }
  | { tipo: "compra_digital"; primera_lectura: string | null }
  | { tipo: "compra_fisica"; modalidad: string }
);

const FECHA = "'%d/%m/%Y %H:%i'";

// Seis consultas pequeñas (una por tipo de hecho) en paralelo, y se ordenan juntas en JavaScript. Una sola consulta
// con UNION obligaría a que todas tuvieran las mismas columnas.
export async function historiaDelLibro(idLector: number, idLibro: number): Promise<HechoDelLibro[]> {
  type F = RowDataPacket & Record<string, unknown>;
  const [[rf], [pf], [rd], [pd], [cd], [cf]] = await Promise.all([
    pool.execute<F[]>(
      `SELECT r.fecha_solicitud AS orden, DATE_FORMAT(r.fecha_solicitud, ${FECHA}) AS fecha, r.estado, s.nombre AS sede,
              DATE_FORMAT(r.fecha_cierre, ${FECHA}) AS cierre
       FROM reserva_fisica r JOIN sede s ON s.id_sede = r.id_sede WHERE r.id_lector = ? AND r.id_libro = ?`,
      [idLector, idLibro]),
    pool.execute<F[]>(
      `SELECT p.fecha_prestamo AS orden, DATE_FORMAT(p.fecha_prestamo, ${FECHA}) AS fecha, p.id_prestamo,
              s.nombre AS sede, DATE_FORMAT(p.fecha_vencimiento, '%d/%m/%Y') AS vence, p.renovaciones,
              DATE_FORMAT(p.fecha_devolucion, ${FECHA}) AS devuelto, sd.nombre AS sede_devolucion, af.pagina
       FROM prestamo_fisico p
       JOIN ejemplar ej ON ej.id_ejemplar = p.id_ejemplar
       JOIN sede s ON s.id_sede = p.id_sede_prestamo
       LEFT JOIN sede sd ON sd.id_sede = p.id_sede_devolucion
       LEFT JOIN avance_fisico af ON af.id_prestamo = p.id_prestamo
       WHERE p.id_lector = ? AND ej.id_libro = ?`,
      [idLector, idLibro]),
    pool.execute<F[]>(
      `SELECT fecha_solicitud AS orden, DATE_FORMAT(fecha_solicitud, ${FECHA}) AS fecha, estado,
              DATE_FORMAT(fecha_cierre, ${FECHA}) AS cierre
       FROM reserva_digital WHERE id_lector = ? AND id_libro = ?`,
      [idLector, idLibro]),
    pool.execute<F[]>(
      `SELECT p.fecha_inicio AS orden, DATE_FORMAT(p.fecha_inicio, ${FECHA}) AS fecha, DATE_FORMAT(p.fecha_fin, ${FECHA}) AS fin,
              DATE_FORMAT(p.fecha_devolucion, ${FECHA}) AS devuelto
       FROM prestamo_digital p JOIN licencia_digital ld ON ld.id_licencia = p.id_licencia
       WHERE p.id_lector = ? AND ld.id_libro = ?`,
      [idLector, idLibro]),
    pool.execute<F[]>(
      `SELECT fecha_otorgado AS orden, DATE_FORMAT(fecha_otorgado, ${FECHA}) AS fecha,
              DATE_FORMAT(fecha_primera_lectura, ${FECHA}) AS primera_lectura
       FROM acceso_digital WHERE id_lector = ? AND id_libro = ?`,
      [idLector, idLibro]),
    pool.execute<F[]>(
      `SELECT pe.fecha_entrega AS orden, DATE_FORMAT(pe.fecha_entrega, ${FECHA}) AS fecha, pe.modalidad
       FROM pedido pe JOIN pedido_detalle dt ON dt.id_pedido = pe.id_pedido JOIN producto pr ON pr.id_producto = dt.id_producto
       WHERE pe.id_lector = ? AND pr.id_libro = ? AND pe.estado = 'entregado' AND pr.tipo = 'fisico'`,
      [idLector, idLibro]),
  ]);
  // `as HechoDelLibro`: las columnas de cada consulta son las de su tipo (escritas arriba, a mano); mysql2 no lo sabe.
  const con = (filas: F[], tipo: HechoDelLibro["tipo"]) =>
    filas.map((f) => ({ ...f, orden: String(f.orden instanceof Date ? f.orden.toISOString() : f.orden), tipo }) as unknown as HechoDelLibro);
  return [...con(rf, "reserva_fisica"), ...con(pf, "prestamo_fisico"), ...con(rd, "reserva_digital"),
          ...con(pd, "prestamo_digital"), ...con(cd, "compra_digital"), ...con(cf, "compra_fisica")]
    .sort((a, b) => b.orden.localeCompare(a.orden)); // lo más reciente primero
}

// ---- Página alcanzada en un préstamo físico (RN-90) ----

// El préstamo, solo si es DEL lector (si no, null: igual que si no existiera), con las páginas de su libro.
export async function prestamoFisicoDelLector(
  idLector: number,
  idPrestamo: number,
): Promise<{ id_libro: number; paginas: number | null } | null> {
  const [filas] = await pool.execute<({ id_libro: number; paginas: number | null } & RowDataPacket)[]>(
    `SELECT l.id_libro, l.paginas FROM prestamo_fisico p
     JOIN ejemplar ej ON ej.id_ejemplar = p.id_ejemplar JOIN libro l ON l.id_libro = ej.id_libro
     WHERE p.id_prestamo = ? AND p.id_lector = ?`,
    [idPrestamo, idLector],
  );
  return filas[0] ?? null;
}

// Guardar (o cambiar) la página; null la borra. Quien llama ya comprobó que el préstamo es del lector.
export async function guardarAvanceFisico(idPrestamo: number, pagina: number | null): Promise<void> {
  if (pagina === null) {
    await pool.execute("DELETE FROM avance_fisico WHERE id_prestamo = ?", [idPrestamo]);
    return;
  }
  await pool.execute(
    `INSERT INTO avance_fisico (id_prestamo, pagina) VALUES (?, ?) AS nueva
     ON DUPLICATE KEY UPDATE pagina = nueva.pagina, fecha_actualizacion = NOW()`,
    [idPrestamo, pagina],
  );
}

// El historial (RN-88): una fila por sesión, la más reciente primero. segundos: el tiempo leído (segundos_activos,
// no ultimo_aviso - inicio, que incluiría los huecos). Los progresos llegan como texto (DECIMAL) y se convierten.
export type SesionDeLectura = {
  id_libro: number;
  formato: FormatoDigital;
  inicio: string;
  segundos: number;
  progreso_inicial: number;
  progreso_final: number;
};

export async function listarSesiones(idLector: number, idLibro: number): Promise<SesionDeLectura[]> {
  type Fila = Omit<SesionDeLectura, "progreso_inicial" | "progreso_final"> & { progreso_inicial: string; progreso_final: string } & RowDataPacket;
  const [filas] = await pool.execute<Fila[]>(
    `SELECT id_libro, formato, DATE_FORMAT(inicio, '%d/%m/%Y %H:%i') AS inicio,
            segundos_activos AS segundos, progreso_inicial, progreso_final
     FROM sesion_lectura WHERE id_lector = ? AND id_libro = ? ORDER BY inicio DESC`,
    [idLector, idLibro],
  );
  return filas.map((f) => ({ ...f, progreso_inicial: Number(f.progreso_inicial), progreso_final: Number(f.progreso_final) }));
}
