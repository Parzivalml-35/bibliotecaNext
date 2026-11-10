import { existeFotoDeAvatar } from "@/lib/data/avatar";
import { FORMA_CLAVE_FOTO, leerFoto } from "@/lib/foto-avatar";
import { tienePermiso } from "@/lib/permisos";
import { obtenerUsuario } from "@/lib/sesion";

// RN-82: entrega la foto de avatar de una cuenta. Route Handler como /leer/[isbn]/archivo: el archivo vive fuera de
// public/ y solo sale tras verificar la sesión. La ven su dueño y los empleados (permiso "lectores": ver la situación
// de un lector). A diferencia del avatar generado (/avatar/[estilo]/[semilla], público), la foto muestra a la persona.
// "foto" es un segmento fijo: Next lo prefiere al dinámico [estilo], así que /avatar/foto/… nunca llega a la otra ruta.

// La misma respuesta para "no hay sesión", "no es tuya", "no existe" y "clave mal formada": no revela qué fotos hay.
const noDisponible = () => new Response("No disponible", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: RouteContext<"/avatar/foto/[clave]">) {
  const { clave } = await ctx.params;
  const usuario = await obtenerUsuario();
  // La forma se valida antes de consultar nada: con "../" la clave podría salir de la carpeta (path traversal).
  if (!usuario || !FORMA_CLAVE_FOTO.test(clave)) return noDisponible();

  // La propia: la clave ya viene en la sesión, sin otra consulta. La de otro: solo un empleado, y solo si alguna cuenta
  // la usa hoy (así no se sirve un archivo huérfano que quedó en el disco).
  const esSuya = usuario.avatar.clave === clave;
  const puedeVerla = esSuya || (usuario.empleado !== null && tienePermiso(usuario.empleado.rol, "lectores") && (await existeFotoDeAvatar(clave)));
  if (!puedeVerla) return noDisponible();

  const foto = await leerFoto(clave);
  if (!foto) return noDisponible();

  return new Response(new Uint8Array(foto), {
    headers: {
      "Content-Type": "image/webp",
      // private: solo el navegador de quien la pidió la guarda, nunca un proxy compartido. Un día (decidido con el
      // usuario): cada foto nueva tiene una clave nueva, así que la URL nunca muestra una vieja; lo único que dura hasta
      // un día es una foto ya borrada en un navegador que la había cargado.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
