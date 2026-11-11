"use client";

import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import type { EntradaIndice, Progreso } from "@/components/visor-epub/motor";
import { cn } from "@/lib/utils";

// El índice del libro con la página donde empieza cada capítulo, como en Readest (solo la idea; el código es nuestro).
// Debajo del capítulo en curso, una fila "Posición actual" con la ubicación exacta.
export function IndiceLibro({ indice, progreso, alElegir }: {
  indice: EntradaIndice[];
  progreso: Progreso | null;
  alElegir: (destino: string) => void;
}) {
  const actual = useRef<HTMLDivElement>(null);

  // Al cambiar de capítulo, la fila "Posición actual" queda a la vista dentro de la lista (que tiene su propio scroll).
  // block "nearest": solo desplaza si hace falta; no recoloca la lista en cada página.
  useEffect(() => {
    actual.current?.scrollIntoView({ block: "nearest" });
  }, [progreso?.destino]);

  if (indice.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">Este libro no trae índice.</p>;

  return (
    <nav aria-label="Índice del libro">
      <ol className="space-y-0.5 p-2">
        {indice.map((e, i) => {
          const esActual = progreso?.destino === e.destino;
          return (
            // key con la posición: un libro puede repetir el mismo destino en dos entradas.
            <li key={i}>
              {/* aria-current="location": el lector de pantalla anuncia "ubicación actual" en esta entrada. */}
              <button type="button" onClick={() => alElegir(e.destino)} aria-current={esActual ? "location" : undefined}
                      // La sangría por nivel va en style: Tailwind solo genera las clases que lee escritas en el código,
                      // y un valor calculado como `pl-${n}` no existiría en el CSS.
                      style={{ paddingLeft: `${0.75 + e.nivel}rem` }}
                      className={cn("flex w-full items-baseline gap-3 rounded-lg py-1.5 pr-3 text-left text-sm transition-colors hover:bg-muted",
                        esActual ? "font-medium text-foreground" : "text-muted-foreground")}>
                <span className="min-w-0 flex-1 truncate">{e.titulo}</span>
                {e.pagina !== null && <span className="shrink-0 text-xs tabular-nums">{e.pagina}</span>}
              </button>
              {esActual && progreso && (
                <div ref={actual} className="mt-0.5 flex items-center gap-2 rounded-lg bg-accent py-1.5 pr-3 text-sm text-accent-foreground"
                     style={{ paddingLeft: `${0.75 + e.nivel}rem` }}>
                  <HugeiconsIcon icon={BookOpen01Icon} className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">Posición actual</span>
                  <span className="text-xs tabular-nums">{progreso.pagina}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
