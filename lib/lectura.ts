// RN-85 a RN-88: las listas permitidas y las validaciones de forma de lo que el lector escribe mientras lee. Sin
// "server-only": la interfaz del visor (Client Components) también las usa para dibujar los colores y validar antes
// de enviar. El servidor las vuelve a aplicar SIEMPRE: lo que llega del navegador no es de fiar.

// ENUM de anotacion.color y anotacion.estilo (db/init/01_schema.sql). Si cambian allí, cambian aquí.
export const COLORES_ANOTACION = ["amarillo", "verde", "azul", "rosa"] as const;
export type ColorAnotacion = (typeof COLORES_ANOTACION)[number];
export const ESTILOS_ANOTACION = ["resaltado", "subrayado", "ondulado"] as const;
export type EstiloAnotacion = (typeof ESTILOS_ANOTACION)[number];

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
