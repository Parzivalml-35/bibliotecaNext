"use client";

import { useActionState } from "react";
import { renovarPrestamo } from "@/lib/actions/circulacion";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// Un formulario por fila: el id del préstamo viaja en un campo oculto. Que venga del navegador no es un
// problema mientras la acción lo vuelva a comprobar (existe, es de la sede del empleado, RN-34).
export function BotonRenovar({ idPrestamo }: { idPrestamo: number }) {
  const [estado, accion, pendiente] = useActionState(renovarPrestamo, estadoInicial);

  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id_prestamo" value={idPrestamo} />
      <button type="submit" disabled={pendiente}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">
        {pendiente ? "Renovando…" : "Renovar"}
      </button>
      {/* aria-live: el resultado se anuncia sin mover el foco. max-w: el mensaje no ensancha la tabla. */}
      <p aria-live="polite" className={`max-w-48 text-right text-xs ${estado.error ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
        {estado.error ?? estado.exito}
      </p>
    </form>
  );
}
