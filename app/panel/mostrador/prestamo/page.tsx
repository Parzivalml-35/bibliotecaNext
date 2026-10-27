import type { Metadata } from "next";
import { FormularioPrestamo } from "@/components/panel/formulario-prestamo";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Nuevo préstamo" };

export default async function PaginaPrestamo() {
  // RN-33: solo bibliotecario y coordinador. La acción lo vuelve a verificar (esta página es solo la puerta).
  const empleado = await exigirEmpleado("mostrador");

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo préstamo</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Se registra en {empleado.sede}. El ejemplar debe estar en esta sede y disponible, o apartado para una
        reserva del mismo lector.
      </p>
      <FormularioPrestamo />
    </div>
  );
}
