import { InsigniaDisponibilidad } from "@/components/insignia-disponibilidad";
import type { DisponibilidadSede } from "@/lib/definitions";
import { plural } from "@/lib/formato";

// Una sede en "¿Dónde está?": cuántas copias hay y en qué estantes (RN-08, RN-17).
export function TarjetaSede({ sede }: { sede: DisponibilidadSede }) {
  return (
    <article className="h-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{sede.sede}</h3>
        <InsigniaDisponibilidad cantidad={sede.disponibles} />
      </div>

      {sede.ubicaciones.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {sede.ubicaciones.map((u) => (
            <li key={`${u.pasillo}-${u.estante}-${u.nivel}`} className="flex items-start gap-3 text-sm">
              {/* Identificación visual: el color de la sección que el lector busca en el estante. */}
              <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded" style={{ backgroundColor: u.color_hex }} />
              <span>
                <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                  Pasillo {u.pasillo} – Estante {u.estante}, nivel {u.nivel}
                </span>
                <span className="block text-zinc-600 dark:text-zinc-400">
                  {u.seccion} · {plural(u.copias, "copia", "copias")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {sede.total === 0
            ? "Esta sede no tiene ejemplares de este libro."
            : `${plural(sede.total, "ejemplar", "ejemplares")} en la sede, ninguno disponible ahora (prestados, apartados o por ubicar).`}
        </p>
      )}
    </article>
  );
}
