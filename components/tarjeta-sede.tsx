import { InsigniaDisponibilidad } from "@/components/insignia-disponibilidad";
import type { DisponibilidadSede } from "@/lib/definitions";
import { plural } from "@/lib/formato";

// Una sede en "¿Dónde está?": cuántas copias hay y en qué estantes (RN-08, RN-17).
export function TarjetaSede({ sede }: { sede: DisponibilidadSede }) {
  return (
    <article className="h-full rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{sede.sede}</h3>
        <InsigniaDisponibilidad cantidad={sede.disponibles} />
      </div>

      {sede.ubicaciones.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {sede.ubicaciones.map((u) => (
            <li key={`${u.pasillo}-${u.estante}-${u.nivel}`} className="flex items-start gap-3 text-sm">
              {/* Identificación visual: el color de la sección que el lector busca en el estante. */}
              <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded" style={{ backgroundColor: u.color_hex }} />
              <span>
                <span className="block font-medium">
                  Pasillo {u.pasillo} – Estante {u.estante}, nivel {u.nivel}
                </span>
                <span className="block text-muted-foreground">
                  {u.seccion} · {plural(u.copias, "copia", "copias")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {sede.total === 0
            ? "Esta sede no tiene ejemplares de este libro."
            : `${plural(sede.total, "ejemplar", "ejemplares")} en la sede, ninguno disponible ahora (prestados, apartados o por ubicar).`}
        </p>
      )}
    </article>
  );
}
