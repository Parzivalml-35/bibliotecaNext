import type { Metadata } from "next";
import { FormularioDevolucion } from "@/components/panel/formulario-devolucion";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Devolución" };

export default async function PaginaDevolucion() {
  const empleado = await exigirEmpleado("mostrador", "/panel/mostrador/devolucion");

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">Devolución</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Se recibe en {empleado.sede}. Se acepta cualquier ejemplar de la red (colección flotante): si es de otra
        sede, pasa a pertenecer a esta.
      </p>
      <FormularioDevolucion />
    </div>
  );
}
