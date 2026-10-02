import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type {
  AutorDeLibro,
  DisponibilidadSede,
  FiltrosCatalogo,
  LibroDetalle,
  LibroResumen,
  PaginaCatalogo,
  Seccion,
  UbicacionConCopias,
} from "@/lib/definitions";

// mysql2 exige que el tipo de las filas extienda RowDataPacket.
type FilaLibroResumen = LibroResumen & RowDataPacket;
type FilaSeccion = Seccion & RowDataPacket;

// En LIKE, % y _ son comodines y \ es el carácter de escape. Si el usuario escribe "50%", buscamos
// literalmente "50%" y no "50 seguido de cualquier cosa": se anteponen \ a esos tres caracteres.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

export const LIBROS_POR_PAGINA = 9;

// Arma el WHERE del catálogo uniendo SOLO fragmentos de SQL escritos aquí; lo que viene del usuario
// va siempre en `valores`, que mysql2 envía aparte para cada ?. Lo usan el conteo y la página.
function construirFiltro(filtros: FiltrosCatalogo): { where: string; valores: string[] } {
  const condiciones: string[] = [];
  const valores: string[] = [];

  if (filtros.texto) {
    const patron = `%${escaparLike(filtros.texto)}%`;
    // EXISTS en vez de filtrar el JOIN de autores: así un libro de dos autores que coincide por uno
    // sigue mostrando a ambos en la columna autores.
    condiciones.push(`(l.titulo LIKE ?
      OR EXISTS (SELECT 1 FROM autor_libro al2 JOIN autor a2 USING (id_autor)
                 WHERE al2.id_libro = l.id_libro AND CONCAT(a2.nombre, ' ', a2.apellido) LIKE ?))`);
    valores.push(patron, patron);
  }

  if (filtros.seccion) {
    condiciones.push("sc.nombre = ?");
    valores.push(filtros.seccion);
  }

  return { where: condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "", valores };
}

type FilaTotal = { total: number } & RowDataPacket;

// Una página del catálogo con su disponibilidad (db/consultas.sql, consulta 1), filtrada opcionalmente.
export async function obtenerPaginaDeLibros(
  filtros: FiltrosCatalogo = {},
  paginaPedida = 1,
): Promise<PaginaCatalogo> {
  // La disponibilidad cambia con cada préstamo: no se puede prerenderizar en el build.
  await connection();
  const { where, valores } = construirFiltro(filtros);

  // 1) Cuántos libros cumplen el filtro (COUNT DISTINCT: los JOIN repiten el libro por autor).
  const [[{ total }]] = await pool.execute<FilaTotal[]>(
    `SELECT COUNT(DISTINCT l.id_libro) AS total
     FROM libro l
     JOIN genero g ON g.id_genero = l.id_genero_principal
     JOIN seccion sc ON sc.id_seccion = g.id_seccion
     ${where}`,
    valores,
  );

  // 2) Se ajusta la página al rango válido: ?pagina=99 muestra la última, no una página vacía.
  const totalPaginas = Math.max(1, Math.ceil(total / LIBROS_POR_PAGINA));
  const pagina = Math.min(Math.max(1, paginaPedida), totalPaginas);
  const desde = (pagina - 1) * LIBROS_POR_PAGINA;

  // 3) Solo los libros de esa página. El orden debe ser total (título y, si empata, id):
  //    con un orden ambiguo, un mismo libro podría aparecer en dos páginas o en ninguna.
  const [libros] = await pool.execute<FilaLibroResumen[]>(
    `SELECT l.id_libro, l.isbn, l.titulo,
            GROUP_CONCAT(DISTINCT CONCAT(a.nombre, ' ', a.apellido) SEPARATOR ', ') AS autores,
            g.nombre AS genero, sc.nombre AS seccion, sc.color_hex,
            (SELECT COUNT(*) FROM ejemplar e
              WHERE e.id_libro = l.id_libro AND e.estado = 'disponible') AS disponibles
     FROM libro l
     JOIN autor_libro al USING (id_libro)
     JOIN autor a USING (id_autor)
     JOIN genero g ON g.id_genero = l.id_genero_principal
     JOIN seccion sc ON sc.id_seccion = g.id_seccion
     ${where}
     GROUP BY l.id_libro
     ORDER BY l.titulo, l.id_libro
     LIMIT ? OFFSET ?`,
    [...valores, LIBROS_POR_PAGINA, desde],
  );

  return { libros, total, pagina, totalPaginas, porPagina: LIBROS_POR_PAGINA };
}

// Las secciones de la red, para el filtro del catálogo.
export async function obtenerSecciones(): Promise<Seccion[]> {
  const [filas] = await pool.execute<FilaSeccion[]>(
    "SELECT nombre, color_hex FROM seccion ORDER BY nombre",
  );
  return filas;
}

type FilaLibroDetalle = Omit<LibroDetalle, "autores" | "generos_secundarios"> & RowDataPacket;
type FilaAutor = AutorDeLibro & RowDataPacket;
type FilaGenero = { nombre: string } & RowDataPacket;

// Un libro por su ISBN, o null si no existe.
// cache() de React: generateMetadata y la página la llaman con el mismo ISBN en una misma petición;
// así la consulta se ejecuta una sola vez (Next solo deduplica fetch, no consultas a la BD).
export const obtenerLibroPorIsbn = cache(async (isbn: string): Promise<LibroDetalle | null> => {
  // El ISBN viene de la URL: va como parámetro (?) y mysql2 lo envía separado del SQL. Nunca en el texto.
  const [filas] = await pool.execute<FilaLibroDetalle[]>(
    `SELECT l.id_libro, l.isbn, l.titulo, l.anio_publicacion, l.sinopsis,
            e.nombre AS editorial, c.nombre AS clasificacion,
            g.nombre AS genero, sc.nombre AS seccion, sc.color_hex
     FROM libro l
     JOIN editorial e USING (id_editorial)
     JOIN clasificacion_edad c USING (id_clasificacion)
     JOIN genero g ON g.id_genero = l.id_genero_principal
     JOIN seccion sc ON sc.id_seccion = g.id_seccion
     WHERE l.isbn = ?`,
    [isbn],
  );

  const libro = filas[0];
  if (!libro) return null;

  // Las dos consultas no dependen una de la otra: se lanzan a la vez y se espera a ambas.
  const [[autores], [generos]] = await Promise.all([
    pool.execute<FilaAutor[]>(
      `SELECT a.nombre, a.apellido, p.nombre AS pais
       FROM autor_libro al
       JOIN autor a USING (id_autor)
       LEFT JOIN pais p USING (id_pais)
       WHERE al.id_libro = ?
       ORDER BY a.apellido`,
      [libro.id_libro],
    ),
    pool.execute<FilaGenero[]>(
      `SELECT g.nombre
       FROM libro_genero lg
       JOIN genero g USING (id_genero)
       WHERE lg.id_libro = ?
       ORDER BY g.nombre`,
      [libro.id_libro],
    ),
  ]);

  return {
    ...libro,
    autores,
    generos_secundarios: generos.map((g) => g.nombre),
  };
});

type FilaSede = Omit<DisponibilidadSede, "ubicaciones"> & RowDataPacket;
type FilaUbicacion = UbicacionConCopias & { id_sede: number } & RowDataPacket;

// RN-08 y RN-17: disponibilidad del libro en cada sede y en qué estantes están sus copias disponibles
// (db/consultas.sql, consultas 2 y 3).
export async function obtenerDisponibilidadPorSede(idLibro: number): Promise<DisponibilidadSede[]> {
  await connection(); // cambia con cada préstamo: siempre en tiempo de petición

  const [[sedes], [ubicaciones]] = await Promise.all([
    pool.execute<FilaSede[]>(
      `SELECT sd.id_sede, sd.nombre AS sede,
              COALESCE(SUM(e.estado = 'disponible'), 0) AS disponibles,   -- SUM de 0 filas es NULL
              COUNT(e.id_ejemplar) AS total
       FROM sede sd
       LEFT JOIN ejemplar e ON e.id_sede = sd.id_sede AND e.id_libro = ?
       GROUP BY sd.id_sede
       ORDER BY sd.nombre`,
      [idLibro],
    ),
    pool.execute<FilaUbicacion[]>(
      `SELECT e.id_sede, u.pasillo, u.estante, u.nivel, sc.nombre AS seccion, sc.color_hex,
              COUNT(*) AS copias
       FROM ejemplar e
       JOIN ubicacion u ON u.id_ubicacion = e.id_ubicacion
       JOIN seccion sc ON sc.id_seccion = u.id_seccion
       WHERE e.id_libro = ? AND e.estado = 'disponible'
       GROUP BY e.id_sede, u.id_ubicacion
       ORDER BY u.pasillo, u.estante, u.nivel`,
      [idLibro],
    ),
  ]);

  // Une las dos consultas: a cada sede le asigna las ubicaciones que le pertenecen.
  return sedes.map((sede) => ({
    ...sede,
    ubicaciones: ubicaciones
      .filter((u) => u.id_sede === sede.id_sede)
      .map(({ pasillo, estante, nivel, seccion, color_hex, copias }) => ({
        pasillo, estante, nivel, seccion, color_hex, copias,
      })),
  }));
}
