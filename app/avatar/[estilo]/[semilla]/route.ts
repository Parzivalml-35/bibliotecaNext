import { Avatar, Style } from "@dicebear/core";
import glass from "@dicebear/styles/glass.json";
import lorelei from "@dicebear/styles/lorelei.json";
import notionists from "@dicebear/styles/notionists.json";
import openPeeps from "@dicebear/styles/open-peeps.json";
import shapes from "@dicebear/styles/shapes.json";
import thumbs from "@dicebear/styles/thumbs.json";
import { esEstiloAvatar, type EstiloAvatar, FORMA_SEMILLA } from "@/lib/avatar";

// RN-81: dibuja el avatar generado de una cuenta como SVG, en el servidor y sin servicios externos. Route Handler como
// /leer/[isbn]/archivo/[formato], pero público: estilo + semilla aleatoria no revelan nada de la persona (la foto de RN-82 sí
// exigirá sesión). Por eso la respuesta se cachea "para siempre": la misma URL es siempre el mismo dibujo.

// Un Style por estilo, creado UNA vez al cargar el módulo (valida el JSON de la definición) y reutilizado en cada
// petición, como recomienda DiceBear 10. Record<EstiloAvatar, Style>: TypeScript exige una definición por cada estilo
// de la lista permitida. Se importan uno por uno (no con un import dinámico por nombre) para que el servidor cargue
// solo estos seis y no los 60 del paquete.
const ESTILOS: Record<EstiloAvatar, Style> = {
  lorelei: new Style(lorelei),
  notionists: new Style(notionists),
  "open-peeps": new Style(openPeeps),
  thumbs: new Style(thumbs),
  shapes: new Style(shapes),
  glass: new Style(glass),
};

const noExiste = () => new Response("No existe", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: RouteContext<"/avatar/[estilo]/[semilla]">) {
  const { estilo, semilla } = await ctx.params;
  // Lista permitida y forma exacta: solo se dibuja lo que la propia BD podría tener guardado.
  if (!esEstiloAvatar(estilo) || !FORMA_SEMILLA.test(semilla)) return noExiste();

  const svg = new Avatar(ESTILOS[estilo], { seed: semilla }).toString();

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // public: también lo puede guardar un proxy. max-age de un año + immutable: el navegador ni siquiera pregunta
      // si cambió. "Generar otro" cambia la semilla, y con ella la URL: nunca se ve un avatar viejo.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Un SVG abierto directo en una pestaña es un documento y podría ejecutar scripts. Este no trae ninguno (lo genera
      // DiceBear desde definiciones del paquete), pero la CSP lo garantiza igual: nada de scripts ni recursos externos.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
