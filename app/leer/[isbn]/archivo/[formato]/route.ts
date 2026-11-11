import { readFile } from "node:fs/promises";
import path from "node:path";
import { marcarPrimeraLectura, obtenerAccesoDeLectura } from "@/lib/data/digital";
import type { FormatoDigital } from "@/lib/definitions";
import { esIsbnValido } from "@/lib/isbn";
import { obtenerUsuario } from "@/lib/sesion";

// RN-29, RN-54: el archivo de una edición (PDF o EPUB) de un título, SOLO para el visor de /leer/[isbn] y solo para
// quien tiene acceso. Es un Route Handler (el equivalente de pages/api en el App Router): devuelve un Response en vez
// de una página. No se cachea: lee la cookie de sesión, y los Route Handlers no se cachean salvo que se pida.
// [formato] (R8b): un segmento dinámico como [isbn]; llega como texto cualquiera, así que se valida con una lista.

const CARPETA = path.join(process.cwd(), "storage", "libros"); // fuera de public/: Next no la sirve sola

// Lista permitida: el formato de la URL tiene que ser una clave de este objeto. Por cada uno, su tipo MIME y la forma
// que debe tener la clave del archivo. Record<FormatoDigital, …>: si el ENUM gana un formato, no compila sin él.
const FORMATOS: Record<FormatoDigital, { tipo: string; clave: RegExp }> = {
  pdf: { tipo: "application/pdf", clave: /^[a-z0-9-]+\.pdf$/ },
  epub: { tipo: "application/epub+zip", clave: /^[a-z0-9-]+\.epub$/ },
};
// Object.hasOwn y no `in`: `"toString" in FORMATOS` es true (viene del prototipo de Object).
const esFormato = (valor: string): valor is FormatoDigital => Object.hasOwn(FORMATOS, valor);

// Misma respuesta para "no existe", "no tienes acceso", "no hay sesión" y "no hay ese formato": no revela qué títulos
// tienen archivo ni en qué formatos.
const noDisponible = () => new Response("No disponible", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, ctx: RouteContext<"/leer/[isbn]/archivo/[formato]">) {
  // El navegador marca cada petición con Sec-Fetch-Dest. Abrir la URL en la barra de direcciones (o en un
  // <iframe>, o en un enlace) manda "document"/"iframe"; el fetch() del visor manda "empty". Así la web no
  // ofrece una forma de abrir o guardar el archivo directo. (Un programa fuera del navegador puede inventar la
  // cabecera: esto es una barrera de uso, no criptografía. Lo que sí garantiza el acceso es la sesión.)
  if (request.headers.get("sec-fetch-dest") !== "empty" || request.headers.get("sec-fetch-site") !== "same-origin") {
    return new Response("Este libro solo se puede leer en el visor de la biblioteca.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { isbn, formato } = await ctx.params;
  const usuario = await obtenerUsuario();
  if (!usuario?.lector || !esIsbnValido(isbn) || !esFormato(formato)) return noDisponible();

  const acceso = await obtenerAccesoDeLectura(usuario.lector.idLector, isbn); // préstamo vigente o compra
  const edicion = acceso?.ediciones.find((e) => e.formato === formato);
  // La clave viene de la BD, pero se valida igual: con "../" podría salir de la carpeta (path traversal).
  if (!acceso || !edicion || !FORMATOS[formato].clave.test(edicion.clave_archivo)) return noDisponible();

  let contenido: Buffer;
  try {
    contenido = await readFile(path.join(CARPETA, edicion.clave_archivo));
  } catch {
    console.error(`Falta el archivo ${edicion.clave_archivo} en storage/libros (¿se corrió pnpm archivos:muestra?)`);
    return noDisponible();
  }
  if (acceso.por === "compra") await marcarPrimeraLectura(usuario.lector.idLector, isbn); // RN-41, RN-61

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": FORMATOS[formato].tipo,
      // Ni el navegador ni un proxy guardan una copia (private + no-store).
      "Cache-Control": "private, no-store",
      // Que el navegador no "adivine" otro tipo, y que otra web no pueda incrustar el recurso.
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
