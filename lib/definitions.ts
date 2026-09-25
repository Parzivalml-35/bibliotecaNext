// Tipos de los datos que devuelven las consultas de lib/data.
// Describen la FORMA de cada fila; no dependen de mysql2 para poder usarse en cualquier capa.

// Un libro tal como se muestra en el catálogo (db/consultas.sql, consulta 1).
export type LibroResumen = {
  id_libro: number;
  titulo: string;
  autores: string; // "Nombre Apellido, Nombre Apellido"
  genero: string; // género principal
  seccion: string;
  color_hex: string; // color de la sección, ej. "#1E40AF"
  disponibles: number; // ejemplares disponibles en toda la red
};
