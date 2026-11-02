import { randomInt } from "node:crypto";

// RN-81: estilos de DiceBear permitidos. Solo estilos con licencia CC0 1.0 (no exige atribución), según
// https://www.dicebear.com/licenses/ (consultado el 2026-11-01). La lista vive en el código y no en una tabla porque
// cada estilo es un archivo del paquete instalado (@dicebear/styles/<estilo>.json): agregar uno exige código (R7f).
// Si se quita un estilo, las cuentas que lo tengan deben pasar a otro (lo resuelve R7f al dibujar).
export const ESTILOS_AVATAR = ["lorelei", "notionists", "open-peeps", "thumbs", "shapes", "glass"] as const;

export type EstiloAvatar = (typeof ESTILOS_AVATAR)[number];

// El estilo de una cuenta nueva, al azar (RN-81: avatar genérico). randomInt usa el generador seguro del sistema;
// aquí no hace falta tanto, pero es el mismo que usa el resto del proyecto. La semilla la pone MySQL (DEFAULT).
export function estiloAlAzar(): EstiloAvatar {
  return ESTILOS_AVATAR[randomInt(ESTILOS_AVATAR.length)];
}
