"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/lib/definitions";

type Accion = (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

const estadoInicial: EstadoFormulario = {};

const VARIANTES = {
  normal: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
  principal: "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  peligro: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950",
};

// Un formulario de un solo botón para una Server Action que actúa sobre un registro (renovar un préstamo,
// cancelar una reserva, cobrar una multa…). La acción llega como prop desde un Server Component: React la
// pasa como referencia, no como código. Los `campos` viajan ocultos y la acción vuelve a comprobarlos
// (que existan y sean de quien los pide): un campo oculto se puede editar en el navegador.
export function BotonAccion({
  accion,
  campos,
  etiqueta,
  etiquetaPendiente,
  variante = "normal",
}: {
  accion: Accion;
  campos: Record<string, string | number>;
  etiqueta: string;
  etiquetaPendiente: string;
  variante?: keyof typeof VARIANTES;
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, estadoInicial);

  return (
    <form action={ejecutar} className="flex flex-col items-end gap-1">
      {Object.entries(campos).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <button type="submit" disabled={pendiente}
              className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${VARIANTES[variante]}`}>
        {pendiente ? etiquetaPendiente : etiqueta}
      </button>
      {/* aria-live: el resultado se anuncia sin mover el foco. max-w: el mensaje no ensancha la tabla. */}
      <p aria-live="polite" className={`max-w-56 text-right text-xs ${estado.error ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
        {estado.error ?? estado.exito}
      </p>
    </form>
  );
}
