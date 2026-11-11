import { createHash, randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { scriptTema } from "@/lib/tema";

// RN-84: la política de seguridad de contenido (CSP) de las páginas de lectura. Un EPUB es HTML y puede traer
// JavaScript; foliate-js NO lo bloquea (su iframe necesita allow-scripts por un bug de WebKit, y los capítulos son
// blob: de nuestro mismo origen, que heredan esta política). Lo bloquea esta cabecera: solo corren los scripts que
// traen el nonce de esta petición (los de Next, que lo pone solo) o el hash de scriptTema.
// Guía: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md ("Adding a nonce with Proxy").
// proxy.ts es el antiguo middleware.ts (renombrado en Next 16): corre en el servidor ANTES de renderizar la ruta.

// El hash del script del tema (layout raíz), calculado una vez al cargar el módulo: el script es un texto fijo. Con
// un hash, el layout raíz sigue siendo estático (no tiene que leer el nonce de la petición para ponérselo).
// Formato CSP: 'sha256-<base64 del SHA-256 del contenido exacto del <script>>'.
const HASH_SCRIPT_TEMA = `'sha256-${createHash("sha256").update(scriptTema).digest("base64")}'`;

function politica(nonce: string): string {
  const desarrollo = process.env.NODE_ENV === "development";
  return [
    // Lo que no se nombra abajo, solo de nuestro propio origen.
    "default-src 'self'",
    // 'strict-dynamic': un script autorizado (con el nonce) puede cargar otros (los trozos de JavaScript de Next); con
    // él, el navegador ignora 'self' y las listas de dominios. Los del libro no tienen nonce: quedan bloqueados, sean
    // <script> en línea, atributos como onerror o archivos del EPUB. 'unsafe-eval' solo en desarrollo: React lo usa
    // para mostrar los errores del servidor (lo dice la guía); en producción no hace falta.
    `script-src 'nonce-${nonce}' 'strict-dynamic' ${HASH_SCRIPT_TEMA}${desarrollo ? " 'unsafe-eval'" : ""}`,
    // Estilos: 'unsafe-inline' porque el libro trae atributos style y sus hojas como blob:, y la interfaz (Radix,
    // Tailwind en desarrollo) también usa estilos en línea. Un estilo no ejecuta código. OJO: no poner aquí el nonce;
    // con un nonce en la directiva, el navegador ignora 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline' blob:",
    // Imágenes y fuentes del libro: foliate-js las entrega como blob:; data: para las incrustadas.
    "img-src 'self' blob: data:",
    "font-src 'self' blob: data:",
    // Los capítulos del EPUB se cargan en <iframe src="blob:…">.
    "frame-src blob:",
    // El worker de pdf.js (VisorPdf) es un archivo de nuestro origen.
    "worker-src 'self'",
    // Nada de <object>/<embed>, ni <base> que cambie a dónde apuntan las URL relativas, ni formularios a otro sitio.
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Nadie puede meter /leer en un iframe de otra página (clickjacking).
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  // Un valor nuevo e impredecible en cada petición: quien quiera colar un script tendría que adivinarlo.
  const nonce = randomBytes(16).toString("base64");
  const csp = politica(nonce);

  // La CSP va DOS veces: en la petición (Next la lee al renderizar, extrae el nonce y se lo pone a sus <script>) y en
  // la respuesta (la que obedece el navegador). request.headers: la petición sigue hacia la página con esta cabecera.
  const cabeceras = new Headers(request.headers);
  cabeceras.set("Content-Security-Policy", csp);
  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

// Solo la página del visor: /leer/<isbn>. ":isbn" es UN segmento, así que no entra la ruta del archivo
// (/leer/<isbn>/archivo/<formato>), que no es HTML. Sin matcher, el proxy correría en TODAS las peticiones.
// Tiene que ser un valor fijo (Next lo lee al compilar, no al ejecutar).
export const config = {
  matcher: "/leer/:isbn",
};
