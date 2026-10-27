import type { Metadata } from "next";
import { FormularioUbicar } from "@/components/panel/formularios-mostrador";
import { obtenerPorUbicar, obtenerUbicacionesDeSede } from "@/lib/data/circulacion";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ubicar ejemplares" };

// RN-20: los ejemplares que llegaron de otra sede esperan aquí hasta tener estante. No cuentan como
// disponibles ni se pueden reservar mientras tanto.
export default async function PaginaUbicar() {
  const empleado = await exigirEmpleado("coleccion");
  const idSede = empleado.idSede!; // estos roles siempre tienen sede (ck_empleado_sede)
  const [pendientes, ubicaciones] = await Promise.all([obtenerPorUbicar(idSede), obtenerUbicacionesDeSede(idSede)]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Ubicar ejemplares</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        {empleado.sede}. El estante sugerido es el de la sección del libro con menos ejemplares. Si hay lectores en cola, el
        ejemplar queda apartado para el primero.
      </p>
      {pendientes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center text-sm dark:border-zinc-700">No hay ejemplares por ubicar.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {pendientes.map((e) => (
            <li key={e.id_ejemplar} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{e.titulo}</div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-mono">{e.codigo_barras}</span>
                  {/* El color va en style: Tailwind genera clases al compilar y no conoce colores que vienen de la BD */}
                  <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: e.color_hex }} />
                  {e.seccion}
                </div>
              </div>
              <FormularioUbicar codigo={e.codigo_barras} sugerida={e.id_ubicacion_sugerida} ubicaciones={ubicaciones} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
