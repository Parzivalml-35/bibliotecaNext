import Link from "next/link";
import { salir } from "@/lib/actions/sesion";
import { obtenerUsuario } from "@/lib/sesion";

// Server Component asíncrono: lee la sesión (cookie + BD). El layout lo envuelve en <Suspense> para que
// esa espera no retrase el resto de la página (la guía lo llama "push dynamic access down").
// Mostrar u ocultar enlaces aquí es solo comodidad: la seguridad está en exigirEmpleado() (RN-35).
export async function MenuUsuario() {
  const usuario = await obtenerUsuario();

  if (!usuario) {
    return (
      <Link href="/login" className="text-sm font-medium hover:underline hover:underline-offset-4">
        Iniciar sesión
      </Link>
    );
  }

  const nombre = usuario.empleado ? `${usuario.empleado.nombre} ${usuario.empleado.apellido}` : usuario.correo;

  return (
    <div className="flex items-center gap-4 text-sm">
      {usuario.empleado && (
        <Link href="/panel" className="font-medium hover:underline hover:underline-offset-4">Panel</Link>
      )}
      {/* hidden sm:inline: en pantallas pequeñas el nombre se oculta para que quepa el resto */}
      <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">{nombre}</span>
      {/* Cerrar sesión es un POST (formulario), no un enlace: un GET no debe cambiar nada en el servidor,
          y un <img src="/salir"> en otra página podría cerrarte la sesión. */}
      <form action={salir}>
        <button type="submit" className="font-medium hover:underline hover:underline-offset-4">Salir</button>
      </form>
    </div>
  );
}
