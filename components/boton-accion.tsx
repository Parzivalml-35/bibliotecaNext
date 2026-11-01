"use client";

import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { EstadoFormulario } from "@/lib/definitions";
import { cn } from "@/lib/utils";

type Accion = (estado: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

const estadoInicial: EstadoFormulario = {};

// R4b: cada variante del proyecto es una variante del Button de shadcn (los nombres se conservan: las páginas
// siguen pasando "principal" o "peligro").
const VARIANTES = {
  normal: "outline",
  principal: "default",
  peligro: "destructive",
} as const;

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
      <button type="submit" disabled={pendiente} className={buttonVariants({ variant: VARIANTES[variante], size: "xs" })}>
        {pendiente ? etiquetaPendiente : etiqueta}
      </button>
      {/* aria-live: el resultado se anuncia sin mover el foco. max-w: el mensaje no ensancha la tabla. */}
      <p aria-live="polite" className={cn("max-w-56 text-right text-xs", estado.error ? "text-danger-texto" : "text-success-texto")}>
        {estado.error ?? estado.exito}
      </p>
    </form>
  );
}
