import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type {
  AutorDeLibro,
  DisponibilidadSede,
  LibroDetalle,
  LibroResumen,
  UbicacionConCopias,
} from "@/lib/definitions";

// mysql2 exige que el tipo de las filas extienda RowDataPacket.
type FilaLibroResumen = LibroResumen & RowDataPacket;

// Todos los libros del catálogo con su disponibilidad total (db/consultas.sql, consulta 1, sin filtro).
export async function obtenerLibros(): Promise<LibroResumen[]> {
  // La disponibilidad cambia con cada préstamo: no se puede prerenderizar en el build.
  // connection() hace que esto se ejecute en cada petición real.
  await connection();
  const [filas] = await pool.execute<FilaLibroResumen[]>(`
    SELECT l.id_libro, l.isbn, l.titulo,
           GROUP_CONCAT(DISTINCT CONCAT(a.nombre, ' ', a.apellido) SEPARATOR ', ') AS autores,
           g.nombre AS genero, sc.nombre AS seccion, sc.color_hex,
           (SELECT COUNT(*) FROM ejemplar e
             WHERE e.id_libro = l.id_libro AND e.estado = 'disponible') AS disponibles
    FROM libro l
    JOIN autor_libro al USING (id_libro)
    JOIN autor a USING (id_autor)
    JOIN genero g ON g.id_genero = l.id_genero_principal
    JOIN seccion sc ON sc.id_seccion = g.id_seccion
    GROUP BY l.id_libro
    ORDER BY l.titulo
  `);
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
