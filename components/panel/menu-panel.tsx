import Link from "next/link";
import { seccionesDe } from "@/lib/permisos";
import { obtenerUsuario } from "@/lib/sesion";

// DI-10, DI-11 (resuelve UX-01): el menú muestra solo las páginas que el rol puede abrir, leídas de lib/permisos.ts,
// la misma lista que usa exigirEmpleado(). Mostrar u ocultar aquí es comodidad: la seguridad sigue en cada página
// y en cada acción (RN-35). Server Component asíncrono: el layout lo envuelve en <Suspense>, como MenuUsuario.
export async function MenuPanel() {
  const usuario = await obtenerUsuario();
  if (!usuario?.empleado) return null; // la página redirige al login; aquí no hay nada que mostrar

  const enlace = "rounded-md px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800";
  return (
    <nav aria-label="Panel de empleado" className="mb-8 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      {seccionesDe(usuario.empleado.rol).flatMap((seccion) =>
        seccion.paginas.map((pagina) => (
          <Link key={pagina.ruta} href={pagina.ruta} className={enlace}>
            {pagina.titulo}
          </Link>
        )),
      )}
    </nav>
  );
}
