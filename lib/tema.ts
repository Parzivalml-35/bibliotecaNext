// docs/diseno.md, DI-03 y DI-04. Lo usan el script del <head> (app/layout.tsx) y el botón de tema.
// No lleva "server-only": el botón, que es un Client Component, también lo importa.

export const TEMAS = ["claro", "oscuro", "lampara"] as const;
export type Tema = (typeof TEMAS)[number];

export const COOKIE_TEMA = "tema";
// Un año. No es una regla de negocio (C-04 no aplica): solo cuánto recuerda el navegador la preferencia.
export const DURACION_COOKIE_TEMA = 60 * 60 * 24 * 365;

// La misma decisión que scriptTema, para el navegador cuando React ya cargó (botón de tema).
// Si cambias una, cambia la otra: el script tiene que ser texto y no puede importar esta función.
export function resolverTema(cookies: string, sistemaOscuro: boolean): Tema {
  const m = cookies.match(new RegExp(`(?:^|; )${COOKIE_TEMA}=([^;]*)`));
  const valor = m ? decodeURIComponent(m[1]) : null;
  const tema = TEMAS.find((t) => t === valor);
  return tema ?? (sistemaOscuro ? "oscuro" : "claro");
}

// Se ejecuta en el navegador mientras lee el HTML, antes del primer pintado: así no hay parpadeo y el layout
// sigue siendo estático (leer la cookie con cookies() lo volvería dinámico).
// 1. Lee la cookie. 2. Si no hay o trae un valor desconocido, sigue al sistema (claro u oscuro).
// 3. Pone data-tema en <html>, que es lo que miran las variables de globals.css.
// El try/catch evita que un error aquí rompa la página: en el peor caso queda el tema claro de :root.
export const scriptTema = `(function(){try{
var m=document.cookie.match(/(?:^|; )${COOKIE_TEMA}=([^;]*)/);
var t=m?decodeURIComponent(m[1]):null;
if(${JSON.stringify(TEMAS)}.indexOf(t)<0)t=matchMedia("(prefers-color-scheme: dark)").matches?"oscuro":"claro";
document.documentElement.setAttribute("data-tema",t);
}catch(e){}})()`;
