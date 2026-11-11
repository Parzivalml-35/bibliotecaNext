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

// La PREFERENCIA, no lo que se ve: base null = "seguir al sistema" (sin cookie `tema`; R7h). Lo que se ve lo deciden
// los atributos (data-tema-base ya trae la base resuelta con el sistema).
export type Preferencia = { base: TemaBase | null; lampara: boolean };

// Type guard: la Server Action de R7h recibe lo que le envíen y lo valida con esto.
export function esTemaBase(valor: unknown): valor is TemaBase {
  return typeof valor === "string" && (TEMAS_BASE as readonly string[]).includes(valor);
}

function leerCookie(cookies: string, nombre: string): string | null {
  const m = cookies.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// La preferencia guardada en las cookies (texto "a=1; b=2": document.cookie en el navegador, o la cabecera Cookie en el
// servidor). Sin cookie `tema` válida, base null: sigue al sistema. Misma lectura que scriptTema: si cambias una, cambia
// la otra (el script tiene que ser texto y no puede importar esta función).
// Compatibilidad: antes de la Fase A la cookie `tema` podía valer "lampara"; se lee como lámpara encendida.
export function resolverPreferencia(cookies: string): Preferencia {
  const tema = leerCookie(cookies, COOKIE_TEMA);
  const base = esTemaBase(tema) ? tema : null;
  const lampara = leerCookie(cookies, COOKIE_LAMPARA) === LAMPARA_ENCENDIDA || tema === "lampara";
  return { base, lampara };
}

// Las dos cookies de una preferencia: nombre, valor y duración. La usan el navegador (aplicarPreferencia) y el servidor
// (el login, R7h), para que las dos formas de escribirlas no se puedan desincronizar. max-age 0 = borrarla: la
// ausencia de `tema` significa "seguir al sistema" y la de `lampara`, "apagada".
export function cookiesDePreferencia(p: Preferencia): { nombre: string; valor: string; maxAge: number }[] {
  return [
    { nombre: COOKIE_TEMA, valor: p.base ?? "", maxAge: p.base ? DURACION_COOKIE_TEMA : 0 },
    { nombre: COOKIE_LAMPARA, valor: p.lampara ? LAMPARA_ENCENDIDA : "", maxAge: p.lampara ? DURACION_COOKIE_TEMA : 0 },
  ];
}

// Solo en el navegador: pone los atributos de <html>, sin tocar las cookies. La usa BotonTema para volver a pintar
// según las cookies tras navegar (el login las escribe desde el servidor y la navegación no recarga el <head>).
export function pintarPreferencia(p: Preferencia) {
  const raiz = document.documentElement;
  // Sin base elegida, la del sistema operativo en este momento (lo mismo que hace scriptTema al cargar).
  const base: TemaBase = p.base ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");
  // dataset.tema es el atributo data-tema: cambiarlo cambia las variables de globals.css al instante.
  const tema: Tema = p.lampara ? "lampara" : base;
  // Solo si cambia: escribir el mismo valor no cambia nada en pantalla, pero sí despierta a los MutationObserver.
  if (raiz.dataset.tema !== tema) raiz.dataset.tema = tema;
  if (raiz.dataset.temaBase !== base) raiz.dataset.temaBase = base;
}

// Solo en el navegador (botones y /cuenta/perfil): pone los atributos y guarda las dos cookies.
export function aplicarPreferencia(p: Preferencia) {
  pintarPreferencia(p);
  for (const c of cookiesDePreferencia(p)) {
    document.cookie = `${c.nombre}=${c.valor}; path=/; max-age=${c.maxAge}; SameSite=Lax`;
  }
}

// La preferencia vigente en este navegador (las cookies). Antes leía los atributos, y la base que se ve siempre es
// concreta: apretar la lámpara escribía esa base en la cookie y el equipo dejaba de seguir al sistema sin pedirlo.
export function preferenciaActual(): Preferencia {
  return resolverPreferencia(document.cookie);
}

// La base que se VE (resuelta con el sistema si no hay preferencia): la necesita el botón sol/luna para alternarla.
export function baseVisible(): TemaBase {
  const base = document.documentElement.dataset.temaBase;
  return esTemaBase(base) ? base : "claro";
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
