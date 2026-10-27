import { NavegacionPanel } from "@/components/panel/navegacion-panel";
import { seccionesDe } from "@/lib/permisos";
import { obtenerUsuario } from "@/lib/sesion";

// DI-10, DI-11 (resuelve UX-01): el menú muestra solo las páginas que el rol puede abrir, leídas de lib/permisos.ts,
// la misma lista que usa exigirEmpleado(). Mostrar u ocultar aquí es comodidad: la seguridad sigue en cada página
// y en cada acción (RN-35). Server Component asíncrono: el layout lo envuelve en <Suspense>, como MenuUsuario.
// Decide QUÉ se muestra (con la sesión, en el servidor); NavegacionPanel marca lo activo (con la ruta, en el cliente).
export async function MenuPanel() {
  const usuario = await obtenerUsuario();
  if (!usuario?.empleado) return null; // la página redirige al login; aquí no hay nada que mostrar

  // Lo que cruza al cliente son objetos simples (títulos y rutas): React los serializa en la respuesta.
  return <NavegacionPanel secciones={seccionesDe(usuario.empleado.rol)} />;
}
