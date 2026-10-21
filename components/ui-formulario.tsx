import type { EstadoFormulario } from "@/lib/definitions";

// Piezas compartidas por los formularios de la Fase 3 (login, préstamo, devolución).
// Sin "use client": sirven tanto en Server como en Client Components.

export const claseEtiqueta = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const claseCampo =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

// disabled:opacity-60 + disabled:cursor-wait: mientras la acción corre (pending), el botón se ve inactivo.
export const claseBoton =
  "rounded-md bg-zinc-900 px-4 py-2 font-medium text-white shadow-sm hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

// Mensaje de resultado. role="alert" hace que el lector de pantalla lo anuncie apenas aparece (el error
// llega sin recargar la página); role="status" es la versión cortés, para confirmaciones.
export function MensajeFormulario({ estado }: { estado: EstadoFormulario }) {
  if (estado.error) {
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {estado.error}
      </p>
    );
  }
  if (estado.exito) {
    return (
      <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        {estado.exito}
      </p>
    );
  }
  return null;
}
