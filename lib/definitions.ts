// Tipos de los datos que devuelven las consultas de lib/data.
// Describen la FORMA de cada fila; no dependen de mysql2 para poder usarse en cualquier capa.

// Un libro tal como se muestra en el catálogo (db/consultas.sql, consulta 1).
export type LibroResumen = {
  id_libro: number;
  isbn: string; // identifica al libro en la URL: /libros/[isbn]
  titulo: string;
  autores: string; // "Nombre Apellido, Nombre Apellido"
  genero: string; // género principal
  seccion: string;
  color_hex: string; // color de la sección, ej. "#1E40AF"
  disponibles: number; // ejemplares disponibles en toda la red
};

// Filtros del catálogo, leídos de la URL (?q=...&seccion=...). Ambos opcionales.
export type FiltrosCatalogo = {
  texto?: string; // busca en el título y en los nombres de los autores
  seccion?: string; // nombre exacto de una sección (ya validado contra la BD)
};

// Sección de la red (RN-18), para el selector del filtro.
export type Seccion = {
  nombre: string;
  color_hex: string;
};

export type AutorDeLibro = {
  nombre: string;
  apellido: string;
  pais: string | null; // la nacionalidad puede no conocerse
};

// Página de detalle de un libro (/libros/[isbn]).
export type LibroDetalle = {
  id_libro: number;
  isbn: string;
  titulo: string;
  anio_publicacion: number | null;
  sinopsis: string | null;
  editorial: string;
  clasificacion: string; // ej. "Todo público", "+15" (RN-46)
  genero: string; // principal: decide sección y color (RN-19)
  seccion: string;
  color_hex: string;
  autores: AutorDeLibro[];
  generos_secundarios: string[];
};

// Un estante (nivel) con copias disponibles de un libro (RN-17).
export type UbicacionConCopias = {
  pasillo: string;
  estante: number;
  nivel: number;
  seccion: string;
  color_hex: string;
  copias: number;
};

// Disponibilidad de un libro en una sede (RN-08) y dónde encontrar sus copias.
export type DisponibilidadSede = {
  id_sede: number;
  sede: string;
  disponibles: number;
  total: number; // ejemplares de la sede, en cualquier estado
  ubicaciones: UbicacionConCopias[];
};
