import { randomInt } from "node:crypto";

// RN-81: estilos de DiceBear permitidos. Solo estilos con licencia CC0 1.0 (no exige atribución), según
// https://www.dicebear.com/licenses/ (consultado el 2026-11-01). La lista vive en el código y no en una tabla porque
// cada estilo es un archivo del paquete instalado (@dicebear/styles/<estilo>.json): agregar uno exige importarlo en
// app/avatar/[estilo]/[semilla]/route.ts. Si se quita uno, las cuentas que lo tengan se dibujan con el primero (urlDeAvatar).
export const ESTILOS_AVATAR = ["lorelei", "notionists", "open-peeps", "thumbs", "shapes", "glass"] as const;

export type EstiloAvatar = (typeof ESTILOS_AVATAR)[number];

// El estilo de una cuenta nueva, al azar (RN-81: avatar genérico). randomInt usa el generador seguro del sistema;
// aquí no hace falta tanto, pero es el mismo que usa el resto del proyecto. La semilla la pone MySQL (DEFAULT).
export function estiloAlAzar(): EstiloAvatar {
  return ESTILOS_AVATAR[randomInt(ESTILOS_AVATAR.length)];
}

// Nombre para mostrar de cada estilo (los de dicebear.com). Record<EstiloAvatar, …> obliga a TypeScript a exigir
// uno por cada estilo de la lista: si se agrega uno y se olvida aquí, el proyecto no compila.
export const NOMBRES_ESTILO: Record<EstiloAvatar, string> = {
  lorelei: "Lorelei",
  notionists: "Notionists",
  "open-peeps": "Open Peeps",
  thumbs: "Thumbs",
  shapes: "Shapes",
  glass: "Glass",
};

// ¿Es un estilo permitido? Un "type guard" (v is EstiloAvatar): si devuelve true, TypeScript trata el valor como
// EstiloAvatar desde ahí. includes() necesita ver la lista como string[] porque el valor todavía es un string cualquiera.
export function esEstiloAvatar(valor: unknown): valor is EstiloAvatar {
  return typeof valor === "string" && (ESTILOS_AVATAR as readonly string[]).includes(valor);
}

// Forma de la semilla que genera el DEFAULT de cuenta.avatar_semilla: 16 bytes en base64url = 22 caracteres.
export const FORMA_SEMILLA = /^[A-Za-z0-9_-]{22}$/;

// RN-81: la URL del avatar generado. El dibujo depende SOLO de estilo y semilla, así que la URL es el contenido y se
// puede cachear para siempre (ver app/avatar/[estilo]/[semilla]/route.ts). Si la cuenta tiene un estilo que ya no está
// en la lista (se quitó del código), se dibuja con el primero: el avatar cambia, pero nunca queda roto.
export function urlDeAvatar(avatar: { estilo: string; semilla: string }): string {
  const estilo = esEstiloAvatar(avatar.estilo) ? avatar.estilo : ESTILOS_AVATAR[0];
  return `/avatar/${estilo}/${avatar.semilla}`;
}
