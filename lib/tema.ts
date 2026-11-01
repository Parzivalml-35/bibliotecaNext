// docs/diseno.md, DI-03 y DI-04. Lo usan el script del <head> (app/layout.tsx) y los botones de tema y de lámpara.
// No lleva "server-only": los botones, que son Client Components, también lo importan.

// Valores de data-tema: lo que miran los bloques de variables de globals.css y las variantes in-data-[tema=…].
export const TEMAS = ["claro", "oscuro", "lampara"] as const;
export type Tema = (typeof TEMAS)[number];

// Fase A: la base (botón flotante) y la lámpara (ícono de la barra) son dos preferencias. Encendida, la lámpara
// reemplaza a la base en data-tema; data-tema-base recuerda la base para volver a ella al apagarla.
export const TEMAS_BASE = ["claro", "oscuro"] as const;
export type TemaBase = (typeof TEMAS_BASE)[number];

export const COOKIE_TEMA = "tema";
export const COOKIE_LAMPARA = "lampara";
const LAMPARA_ENCENDIDA = "encendida";
// Un año. No es una regla de negocio (C-04 no aplica): solo cuánto recuerda el navegador la preferencia.
export const DURACION_COOKIE_TEMA = 60 * 60 * 24 * 365;

export type Preferencia = { base: TemaBase; lampara: boolean };

function leerCookie(cookies: string, nombre: string): string | null {
  const m = cookies.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// La misma decisión que scriptTema, para el navegador cuando React ya cargó (botones).
// Si cambias una, cambia la otra: el script tiene que ser texto y no puede importar esta función.
// Compatibilidad: antes de la Fase A la cookie `tema` podía valer "lampara"; se lee como lámpara encendida.
export function resolverPreferencia(cookies: string, sistemaOscuro: boolean): Preferencia {
  const tema = leerCookie(cookies, COOKIE_TEMA);
  const base = TEMAS_BASE.find((t) => t === tema) ?? (sistemaOscuro ? "oscuro" : "claro");
  const lampara = leerCookie(cookies, COOKIE_LAMPARA) === LAMPARA_ENCENDIDA || tema === "lampara";
  return { base, lampara };
}

export const temaDe = (p: Preferencia): Tema => (p.lampara ? "lampara" : p.base);

// Solo en el navegador (la llaman los botones): pone los atributos y guarda las dos cookies.
export function aplicarPreferencia(p: Preferencia) {
  const raiz = document.documentElement;
  // dataset.tema es el atributo data-tema: cambiarlo cambia las variables de globals.css al instante.
  raiz.dataset.tema = temaDe(p);
  raiz.dataset.temaBase = p.base;
  const fin = `path=/; max-age=${DURACION_COOKIE_TEMA}; SameSite=Lax`;
  document.cookie = `${COOKIE_TEMA}=${p.base}; ${fin}`;
  // Apagada, la cookie se borra (max-age=0): la ausencia significa "apagada".
  document.cookie = `${COOKIE_LAMPARA}=${p.lampara ? LAMPARA_ENCENDIDA : ""}; path=/; max-age=${p.lampara ? DURACION_COOKIE_TEMA : 0}; SameSite=Lax`;
}

// Lo que dicen los atributos que puso el script (la preferencia vigente en la página).
export function preferenciaActual(): Preferencia {
  const raiz = document.documentElement;
  const base = TEMAS_BASE.find((t) => t === raiz.dataset.temaBase) ?? "claro";
  return { base, lampara: raiz.dataset.tema === "lampara" };
}

// Se ejecuta en el navegador mientras lee el HTML, antes del primer pintado: así no hay parpadeo y el layout
// sigue siendo estático (leer la cookie con cookies() lo volvería dinámico).
// 1. Lee las dos cookies. 2. Sin base válida, sigue al sistema (claro u oscuro). 3. Pone data-tema (la lámpara manda
// si está encendida) y data-tema-base. El try/catch evita que un error rompa la página: queda el claro de :root.
export const scriptTema = `(function(){try{
function c(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}
var t=c(${JSON.stringify(COOKIE_TEMA)});
var b=${JSON.stringify(TEMAS_BASE)}.indexOf(t)<0?(matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro"):t;
var l=c(${JSON.stringify(COOKIE_LAMPARA)})===${JSON.stringify(LAMPARA_ENCENDIDA)}||t==="lampara";
var r=document.documentElement;r.setAttribute("data-tema",l?"lampara":b);r.setAttribute("data-tema-base",b);
}catch(e){}})()`;
