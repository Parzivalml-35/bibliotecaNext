import { MenuNotificaciones } from "@/components/menu-notificaciones";
import { notificacionesDeCuenta } from "@/lib/data/notificaciones";
import { obtenerUsuario } from "@/lib/sesion";

// RN-91: la campana de la barra superior. Server Component asíncrono, como MenuUsuario: lee la sesión y las
// notificaciones en el servidor, y le pasa al menú (Client Component) solo datos simples. El layout la envuelve en
// <Suspense>, así esta espera no retrasa la página. obtenerUsuario() está en cache(): MenuUsuario y la campana leen la
// sesión una sola vez por petición.
//
// Vive en app/(sitio)/layout.tsx, así que /leer (fuera de ese grupo de rutas) no la muestra: la lectura no se
// interrumpe, como pidió el usuario, sin ninguna condición en el código.
export async function CampanaNotificaciones() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null; // sin sesión no hay a quién avisar

  const { lista, noLeidas } = await notificacionesDeCuenta(usuario.idCuenta);
  return <MenuNotificaciones notificaciones={lista} noLeidas={noLeidas} />;
}
