import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import { limitesDeLectura, registrarLatido } from "@/lib/data/lectura";
import { enTransaccion } from "@/lib/db";
import type { FormatoDigital } from "@/lib/definitions";
import { esIsbnValido } from "@/lib/isbn";
import { esCfi, type Posicion } from "@/lib/lectura";
import { obtenerUsuario } from "@/lib/sesion";

// RN-88: el "latido" del visor. Mientras el libro está abierto y visible, el visor envía aquí cada
// segundos_latido_lectura su posición; el servidor extiende la sesión de lectura (o crea otra tras la pausa) y guarda
// la posición. Es un Route Handler y no una Server Action porque al SALIR de la página el visor lo envía con
// navigator.sendBeacon (el navegador lo entrega aunque la página se esté cerrando), y sendBeacon hace un POST simple a
// una URL: no sabe llamar a una Server Action.
//
// Cuerpo (JSON): { formato: "epub", cfi: "epubcfi(…)", fraccion: 0.42 } o { formato: "pdf", pagina: 7, fraccion: 0.3 }.
// Respuesta: 204 sin cuerpo si quedó guardado; 4xx si no (el visor no muestra nada: el latido es silencioso).

const MAX_CUERPO = 2000; // bytes: un CFI cabe en 500; nada legítimo se acerca a esto
const sinContenido = (estado: number) => new Response(null, { status: estado, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, ctx: RouteContext<"/leer/[isbn]/latido">) {
  // Solo desde páginas de nuestro origen. La cookie de sesión es SameSite=Lax y no viaja en un POST desde otro sitio
  // (CSRF); Sec-Fetch-Site lo confirma (fetch y sendBeacon desde /leer mandan "same-origin").
  if (request.headers.get("sec-fetch-site") !== "same-origin") return sinContenido(403);

  const usuario = await obtenerUsuario();
  if (!usuario?.lector) return sinContenido(401);
  const { isbn } = await ctx.params;
  if (!esIsbnValido(isbn)) return sinContenido(404);

  // El cuerpo se lee como texto y con tope antes de interpretarlo: así un cuerpo enorme no se procesa.
  const crudo = await request.text();
  if (crudo.length > MAX_CUERPO) return sinContenido(413);
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return sinContenido(400);
  }
  if (typeof datos !== "object" || datos === null) return sinContenido(400);
  const { formato, cfi, pagina, fraccion } = datos as Record<string, unknown>;

  // Forma de la posición según el formato (el CHECK ck_posicion_formato de la BD exige lo mismo).
  if (typeof fraccion !== "number" || !Number.isFinite(fraccion) || fraccion < 0 || fraccion > 1) return sinContenido(400);
  let posicion: Posicion;
  if (formato === "epub" && esCfi(cfi)) posicion = { cfi, pagina: null, fraccion };
  else if (formato === "pdf" && typeof pagina === "number" && Number.isInteger(pagina) && pagina >= 1 && pagina <= 65535) {
    posicion = { cfi: null, pagina, fraccion };
  } else return sinContenido(400);

  // RN-88: solo con acceso vigente, y en un formato que el título tenga.
  const acceso = await obtenerAccesoDeLectura(usuario.lector.idLector, isbn);
  if (!acceso || !acceso.ediciones.some((e) => e.formato === formato)) return sinContenido(404);

  const { minutos_pausa_lectura } = await limitesDeLectura();
  try {
    await enTransaccion((conexion) =>
      registrarLatido(conexion, usuario.lector!.idLector, acceso.id_libro, formato as FormatoDigital, posicion, minutos_pausa_lectura));
  } catch (error) {
    console.error("No se pudo registrar el latido de lectura:", error);
    return sinContenido(500);
  }
  return sinContenido(204);
}
