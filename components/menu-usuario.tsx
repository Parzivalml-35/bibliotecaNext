import { EnlacesSinSesion } from "@/components/enlaces-sin-sesion";
import { MenuCuenta } from "@/components/menu-cuenta";
import { obtenerUsuario } from "@/lib/sesion";

// Server Component asíncrono: lee la sesión (cookie + BD). El layout lo envuelve en <Suspense> para que
// esa espera no retrase el resto de la página (la guía lo llama "push dynamic access down").
// Decide QUÉ se muestra; las partes interactivas (el menú que se abre, el enlace que conoce la ruta) son
// Client Components que reciben solo datos simples. Mostrar u ocultar aquí es comodidad: la seguridad está
// en exigirEmpleado() y exigirLector() (RN-35).
export async function MenuUsuario() {
  const usuario = await obtenerUsuario();
  if (!usuario) return <EnlacesSinSesion />;

  const nombre = usuario.empleado
    ? `${usuario.empleado.nombre} ${usuario.empleado.apellido}`
    : (usuario.lector?.nombre ?? usuario.correo);

  return (
    <MenuCuenta
      nombre={nombre}
      correo={usuario.correo}
      esLector={usuario.lector !== null}
      esEmpleado={usuario.empleado !== null}
    />
  );
}
