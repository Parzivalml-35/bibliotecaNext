import "server-only";
import { connection } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";
import type { LibroResumen } from "@/lib/definitions";

// mysql2 exige que el tipo de las filas extienda RowDataPacket.
type FilaLibroResumen = LibroResumen & RowDataPacket;

// Todos los libros del catálogo con su disponibilidad total (db/consultas.sql, consulta 1, sin filtro).
export async function obtenerLibros(): Promise<LibroResumen[]> {
  // La disponibilidad cambia con cada préstamo: no se puede prerenderizar en el build.
  // connection() hace que esto se ejecute en cada petición real.
  await connection();
  const [filas] = await pool.execute<FilaLibroResumen[]>(`
    SELECT l.id_libro, l.titulo,
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
