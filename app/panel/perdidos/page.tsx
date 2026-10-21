import type { Metadata } from "next";
import { BotonAccion } from "@/components/boton-accion";
import { declararPerdido } from "@/lib/actions/circulacion";
import { obtenerCandidatosAPerdido } from "@/lib/data/circulacion";
import { pesos, plural } from "@/lib/formato";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ejemplares perdidos" };

// RN-49: la lista se CALCULA (préstamos con más de dias_atraso_perdido días de atraso); declarar perdido es
// decisión del empleado, nunca automática.
export default async function PaginaPerdidos() {
  const empleado = await exigirEmpleado(["bibliotecario", "coordinador"]);
  const candidatos = await obtenerCandidatosAPerdido(empleado.idSede!);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Candidatos a perdido</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Préstamos de {empleado.sede} con demasiados días de atraso. Al declararlo perdido se genera la multa de reposición
        y el préstamo deja de contar como vencido.
      </p>
      {candidatos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center text-sm dark:border-zinc-700">No hay candidatos.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {candidatos.map((c) => (
            <li key={c.id_prestamo} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{c.titulo} <span className="font-mono text-xs text-zinc-500">{c.codigo_barras}</span></div>
                <div className="text-xs text-zinc-500">{c.lector} · {plural(c.dias_atraso, "día", "días")} de atraso · reposición {pesos(c.valor_reposicion)}</div>
              </div>
              <BotonAccion accion={declararPerdido} campos={{ id_prestamo: c.id_prestamo }} etiqueta="Declarar perdido"
                           etiquetaPendiente="Registrando…" variante="peligro" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
