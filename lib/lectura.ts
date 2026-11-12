// RN-85 a RN-88: las listas permitidas y las validaciones de forma de lo que el lector escribe mientras lee. Sin
// "server-only": la interfaz del visor (Client Components) también las usa para dibujar los colores y validar antes
// de enviar. El servidor las vuelve a aplicar SIEMPRE: lo que llega del navegador no es de fiar.

// ENUM de anotacion.color y anotacion.estilo (db/init/01_schema.sql). Si cambian allí, cambian aquí.
export const COLORES_ANOTACION = ["amarillo", "verde", "azul", "rosa"] as const;
export type ColorAnotacion = (typeof COLORES_ANOTACION)[number];
export const ESTILOS_ANOTACION = ["resaltado", "subrayado", "ondulado"] as const;
export type EstiloAnotacion = (typeof ESTILOS_ANOTACION)[number];

// Nombre para mostrar y colores de cada opción. `fondo`: el resaltado (foliate lo dibuja con 30 % de opacidad, así se
// lee el texto encima en los tres temas). `linea`: subrayado y ondulado, más oscuro (una línea fina amarilla clara no
// se vería sobre papel blanco). Record<…>: si el ENUM gana un valor, no compila sin su nombre y sus colores.
export const COLOR_ANOTACION: Record<ColorAnotacion, { nombre: string; fondo: string; linea: string }> = {
  amarillo: { nombre: "Amarillo", fondo: "#facc15", linea: "#ca8a04" },
  verde: { nombre: "Verde", fondo: "#4ade80", linea: "#16a34a" },
  azul: { nombre: "Azul", fondo: "#60a5fa", linea: "#2563eb" },
  rosa: { nombre: "Rosa", fondo: "#f472b6", linea: "#db2777" },
};
export const NOMBRE_ESTILO_ANOTACION: Record<EstiloAnotacion, string> = {
  resaltado: "Resaltado",
  subrayado: "Subrayado",
  ondulado: "Ondulado",
};

// Un resaltado como lo usan la página, el visor y "Mis lecturas" (las columnas de `anotacion` que se muestran).
export type Anotacion = {
  id_anotacion: number;
  cfi: string;
  texto_citado: string;
  color: ColorAnotacion;
  estilo: EstiloAnotacion;
  nota: string | null;
  fecha_creacion: string; // "11/11/2026 14:05", ya formateada para mostrar
};

// Una nota libre (RN-86) como la usan la página, el visor y "Mis lecturas". cfi y capitulo: dónde estaba el lector al
// escribirla (null si no se supo). editada: 1 si se cambió después de escribirla (MySQL devuelve el booleano como número).
export type NotaLibre = {
  id_nota_libre: number;
  texto: string;
  cfi: string | null;
  capitulo: string | null;
  fecha_creacion: string; // ya formateada para mostrar
  editada: number;
};

// RN-88: dónde quedó el lector en un formato. EPUB: cfi (pagina null); PDF: pagina (cfi null). fraccion: avance de 0 a
// 1. Lo leen la página (para retomar) y la ruta del latido; aquí y no en lib/data porque el visor también lo usa.
export type Posicion = { cfi: string | null; pagina: number | null; fraccion: number };

// ENUM de formato en sesion_lectura y posicion_lectura (el mismo de edicion_digital).
export const FORMATOS_LECTURA = ["pdf", "epub"] as const;

export function esColorAnotacion(v: unknown): v is ColorAnotacion {
  return typeof v === "string" && (COLORES_ANOTACION as readonly string[]).includes(v);
}
export function esEstiloAnotacion(v: unknown): v is EstiloAnotacion {
  return typeof v === "string" && (ESTILOS_ANOTACION as readonly string[]).includes(v);
}

// La forma de un EPUB CFI: "epubcfi(…)" sin espacios ni saltos de línea, y que quepa en la columna (VARCHAR(500)).
// No se interpreta en el servidor (eso lo hace el visor); solo se impide guardar algo que no lo es.
const MAX_CFI = 500;
export function esCfi(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_CFI && /^epubcfi\([^\s]+\)$/.test(v);
}

// Largo en CARACTERES como los cuenta MySQL (CHAR_LENGTH): por puntos de código. String.length cuenta unidades UTF-16,
// y un emoji o una letra fuera del plano básico valdría 2.
export function largo(texto: string): number {
  return Array.from(texto).length;
}
export function recortar(texto: string, maximo: number): string {
  const letras = Array.from(texto);
  return letras.length <= maximo ? texto : letras.slice(0, maximo).join("");
}
