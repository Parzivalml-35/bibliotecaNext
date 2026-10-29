// DI-05: color de la portada generada. Sale del ISBN, así que el mismo libro tiene siempre el mismo color, en
// cualquier página, tema y reconstrucción de la BD. Igual en los tres temas (decidido en R4c): es como el objeto.
// Sin "server-only": no hay secretos y es una función pura.

// L y C fijos, solo cambia el tono (h). Medido con un script (R4c) sobre los 360 tonos:
// - C = 0.080 es el croma más alto que cabe en sRGB con L = 0.48 para TODOS los tonos (con más, el navegador recorta).
// - Texto blanco encima: contraste mínimo 6.26:1; blanco al 85 % (el autor): 5.02:1. Ambos ≥ 4.5 (DI-07).
const LUMINOSIDAD = 0.48;
const CROMA = 0.08;

// FNV-1a de 32 bits: un hash corto y conocido que reparte bien entradas parecidas. Con `ISBN mod 360`, los ISBN
// consecutivos del catálogo simulado (999…) darían tonos vecinos, casi iguales.
function fnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    // Math.imul multiplica como un entero de 32 bits (una multiplicación normal perdería precisión);
    // >>> 0 lo deja sin signo.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function colorDePortada(isbn: string): string {
  return `oklch(${LUMINOSIDAD} ${CROMA} ${fnv1a(isbn) % 360})`;
}
