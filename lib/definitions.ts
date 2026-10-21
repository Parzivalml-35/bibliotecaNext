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

// Una página del catálogo: los libros de esa página y lo necesario para dibujar la paginación.
export type PaginaCatalogo = {
  libros: LibroResumen[];
  total: number; // libros que cumplen el filtro, en todas las páginas
  pagina: number; // página mostrada (ya ajustada al rango válido)
  totalPaginas: number;
  porPagina: number;
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

// ---------------------------------------------------------------------
// Fase 3: sesión, panel de empleado y circulación
// ---------------------------------------------------------------------

export type RolEmpleado = "bibliotecario" | "coordinador" | "admin_red";

// Lo que la app sabe de quien inició sesión (RN-64). Solo datos para la interfaz y los permisos:
// nunca el hash de la contraseña ni el token.
export type UsuarioSesion = {
  idCuenta: number;
  correo: string;
  empleado: {
    idEmpleado: number;
    nombre: string;
    apellido: string;
    rol: RolEmpleado;
    idSede: number | null; // null solo para admin_red (RN-34)
    sede: string | null;
  } | null; // null si la cuenta no tiene perfil de empleado activo
};

export type EmpleadoSesion = NonNullable<UsuarioSesion["empleado"]>;

// Estado que una Server Action devuelve a su formulario a través de useActionState.
export type EstadoFormulario = {
  error?: string; // mensaje para el usuario
  exito?: string; // confirmación de la operación
  valores?: Record<string, string>; // lo que escribió, para no borrárselo si hubo error
};

// Un préstamo abierto como se lista en el panel (db/consultas.sql, consulta 5).
export type PrestamoAbierto = {
  id_prestamo: number;
  codigo_barras: string;
  titulo: string;
  lector: string;
  sede: string;
  fecha_prestamo: string; // "AAAA-MM-DD" (DATE_FORMAT en SQL)
  fecha_vencimiento: string;
  renovaciones: number;
  dias_atraso: number; // 0 si está al día
};
