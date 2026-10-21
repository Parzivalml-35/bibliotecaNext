import { readFile } from "node:fs/promises";
import path from "node:path";
import { marcarPrimeraLectura, obtenerAccesoDeLectura } from "@/lib/data/digital";
import { esIsbnValido } from "@/lib/isbn";
import { obtenerUsuario } from "@/lib/sesion";

// RN-29: el PDF de un título, SOLO para el visor de /leer/[isbn] y solo para quien tiene acceso.
// Es un Route Handler (el equivalente de pages/api en el App Router): devuelve un Response en vez de una página.
// No se cachea: lee la cookie de sesión, y los Route Handlers no se cachean salvo que se pida.

const CARPETA = path.join(process.cwd(), "storage", "libros"); // fuera de public/: Next no la sirve sola

// Misma respuesta para "no existe", "no tienes acceso" y "no hay sesión": no revela qué títulos tienen PDF.
const noDisponible = () => new Response("No disponible", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, ctx: RouteContext<"/leer/[isbn]/archivo">) {
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

  const { isbn } = await ctx.params;
  const usuario = await obtenerUsuario();
  if (!usuario?.lector || !esIsbnValido(isbn)) return noDisponible();

  const acceso = await obtenerAccesoDeLectura(usuario.lector.idLector, isbn); // préstamo vigente o compra
  // La clave viene de la BD, pero se valida igual: con "../" podría salir de la carpeta (path traversal).
  if (!acceso || !/^[a-z0-9-]+\.pdf$/.test(acceso.clave_archivo)) return noDisponible();

  let contenido: Buffer;
  try {
    contenido = await readFile(path.join(CARPETA, acceso.clave_archivo));
  } catch {
    console.error(`Falta el archivo ${acceso.clave_archivo} en storage/libros (¿se corrió pnpm archivos:muestra?)`);
    return noDisponible();
  }
  if (acceso.por === "compra") await marcarPrimeraLectura(usuario.lector.idLector, isbn); // RN-41, RN-61

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type": "application/pdf",
      // Ni el navegador ni un proxy guardan una copia (private + no-store).
      "Cache-Control": "private, no-store",
      // Que el navegador no "adivine" otro tipo, y que otra web no pueda incrustar el recurso.
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
