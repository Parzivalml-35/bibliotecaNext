import type { Metadata } from "next";
import { EstadoVacio } from "@/components/estado-vacio";
import { FormularioUbicar } from "@/components/panel/formularios-mostrador";
import { obtenerPorUbicar, obtenerUbicacionesDeSede } from "@/lib/data/circulacion";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Ubicar ejemplares" };

// RN-20: los ejemplares que llegaron de otra sede esperan aquí hasta tener estante. No cuentan como
// disponibles ni se pueden reservar mientras tanto.
export default async function PaginaUbicar() {
  const empleado = await exigirEmpleado("coleccion", "/panel/coleccion/ubicar");
  const idSede = empleado.idSede!; // estos roles siempre tienen sede (ck_empleado_sede)
  const [pendientes, ubicaciones] = await Promise.all([obtenerPorUbicar(idSede), obtenerUbicacionesDeSede(idSede)]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Ubicar ejemplares</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {empleado.sede}. El estante sugerido es el de la sección del libro con menos ejemplares. Si hay lectores en cola, el
        ejemplar queda apartado para el primero.
      </p>
      {pendientes.length === 0 ? (
        <EstadoVacio>No hay ejemplares por ubicar.</EstadoVacio>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {pendientes.map((e) => (
            <li key={e.id_ejemplar} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{e.titulo}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
