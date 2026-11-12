"use client";

import { useId } from "react";
import type { AjustesLectura } from "@/components/visor-epub/motor";
import { cn } from "@/lib/utils";

// Ajustes de lectura (se guardan en este navegador, no en la BD): tamaño de letra y columnas. Cada grupo es un
// <fieldset> con radios nativos: el teclado los recorre con las flechas y el lector de pantalla anuncia "1 de 4".
// El círculo del radio no se ve (sr-only); la tarjeta entera es la etiqueta y se pinta con has-checked: (CSS :has()).

export const TAMANOS_LETRA = [90, 100, 120, 140] as const;

const claseOpcion =
  "flex cursor-pointer items-center justify-center rounded-xl border border-border px-3 py-2 transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50";

export function AjustesDeLectura({ ajustes, alCambiar }: {
  ajustes: AjustesLectura;
  alCambiar: (nuevos: AjustesLectura) => void;
}) {
  // Nombres únicos para los grupos de radios: la barra lateral existe dos veces en la página (fija y en el cajón del
  // celular), y dos grupos con el mismo `name` serían para el navegador UN solo grupo.
  const id = useId();
  return (
    <div className="space-y-5 p-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tamaño de letra</legend>
        <div className="grid grid-cols-4 gap-2">
          {TAMANOS_LETRA.map((t) => (
            <label key={t} className={claseOpcion}>
              <input type="radio" name={`${id}-letra`} value={t} checked={ajustes.letra === t}
                     onChange={() => alCambiar({ ...ajustes, letra: t })} className="sr-only" />
              {/* La "Aa" de cada opción crece con el tamaño (en style: un valor por opción). El % lo lee el lector de
                  pantalla. */}
              <span aria-hidden="true" className="font-heading leading-none" style={{ fontSize: `${t * 0.15}px` }}>Aa</span>
              <span className="sr-only">{t} %</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Columnas</legend>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {([1, 2] as const).map((c) => (
            <label key={c} className={cn(claseOpcion, "flex-col gap-0.5 text-center")}>
              <input type="radio" name={`${id}-columnas`} value={c} checked={ajustes.columnas === c}
                     onChange={() => alCambiar({ ...ajustes, columnas: c })} className="sr-only" />
              <span className="font-medium">{c === 1 ? "Una" : "Dos"}</span>
              <span className="text-xs opacity-80">{c === 1 ? "Siempre" : "Si la pantalla es ancha"}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-muted-foreground">Se guardan en este navegador.</p>
    </div>
  );
}
