"use client";

import { Delete02Icon, NoteEditIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import type { Rectangulo } from "@/components/visor-epub/motor";
import {
  COLOR_ANOTACION,
  COLORES_ANOTACION,
  type ColorAnotacion,
  ESTILOS_ANOTACION,
  type EstiloAnotacion,
  largo,
  NOMBRE_ESTILO_ANOTACION,
} from "@/lib/lectura";
import { cn } from "@/lib/utils";

// RN-85: el menú que aparece junto al texto, al seleccionar (marcar uno nuevo) o al tocar una marca (cambiarla).
// Colores, estilos, nota y borrar. Flota con position: fixed sobre el visor, ubicado con el rectángulo del texto.

const ANCHO = 300; // px; para centrarlo bajo el texto y que no se salga de la pantalla

export type DatosMenu = {
  rect: Rectangulo;
  color: ColorAnotacion;
  estilo: EstiloAnotacion;
  nota: string | null;
  existente: boolean; // true: una marca ya guardada (se puede borrar)
  conNota: boolean; // abrir directamente el editor de la nota (modo "resaltar y anotar")
};

export function MenuResaltado({ datos, maxNota, guardando, alElegir, alGuardarNota, alBorrar, alCerrar }: {
  datos: DatosMenu;
  maxNota: number;
  guardando: boolean;
  alElegir: (color: ColorAnotacion, estilo: EstiloAnotacion) => void;
  alGuardarNota: (nota: string) => void;
  alBorrar: () => void;
  alCerrar: () => void;
}) {
  const [editando, setEditando] = useState(datos.conNota);
  const [nota, setNota] = useState(datos.nota ?? "");
  const caja = useRef<HTMLDivElement>(null);

  // Al abrir, el foco va al menú (teclado y lector de pantalla). Esc lo cierra.
  useEffect(() => {
    caja.current?.querySelector<HTMLElement>(editando ? "textarea" : "button")?.focus();
    const alPresionar = (e: KeyboardEvent) => { if (e.key === "Escape") alCerrar(); };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [alCerrar, editando]);

  // Ubicación: centrado bajo el texto; si no cabe abajo, arriba. Nunca fuera de los bordes (8 px de margen).
  const { rect } = datos;
  const izquierda = Math.min(Math.max(rect.x + rect.ancho / 2 - ANCHO / 2, 8), window.innerWidth - ANCHO - 8);
  const abajo = rect.y + rect.alto + 8;
  const cabeAbajo = abajo + (editando ? 260 : 110) < window.innerHeight;
  const posicion = cabeAbajo ? { top: abajo } : { bottom: window.innerHeight - rect.y + 8 };

  const exceso = largo(nota.trim()) > maxNota;

  return (
    // z-50: encima del libro y de las zonas laterales. role="dialog" + aria-label: el lector de pantalla lo anuncia.
    <div ref={caja} role="dialog" aria-label={datos.existente ? "Editar el fragmento marcado" : "Marcar el fragmento"}
         style={{ left: izquierda, width: ANCHO, ...posicion }}
         className="fixed z-50 space-y-2 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
      <div className="flex items-center gap-1">
        {COLORES_ANOTACION.map((c) => (
          // aria-pressed: el lector de pantalla anuncia cuál es el color actual de una marca existente.
          <button key={c} type="button" disabled={guardando} onClick={() => alElegir(c, datos.estilo)}
                  aria-pressed={datos.existente ? datos.color === c : undefined} title={COLOR_ANOTACION[c].nombre}
                  className={cn("size-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    datos.existente && datos.color === c ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: COLOR_ANOTACION[c].fondo }}>
            <span className="sr-only">{COLOR_ANOTACION[c].nombre}</span>
          </button>
        ))}
        <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />
        {ESTILOS_ANOTACION.map((e) => (
          // La muestra "Aa" se ve con el estilo real: fondo, subrayado o subrayado ondulado (decoration-wavy).
          <button key={e} type="button" disabled={guardando} onClick={() => alElegir(datos.color, e)}
                  aria-pressed={datos.existente ? datos.estilo === e : undefined} title={NOMBRE_ESTILO_ANOTACION[e]}
                  className={cn("rounded-lg px-1.5 py-1 text-sm transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    datos.existente && datos.estilo === e && "bg-muted")}>
            <span aria-hidden="true" className={cn("font-heading",
              e === "subrayado" && "underline decoration-2 underline-offset-2",
              e === "ondulado" && "underline decoration-wavy decoration-2 underline-offset-2")}
                  style={e === "resaltado" ? { backgroundColor: `${COLOR_ANOTACION[datos.color].fondo}66` }
                    : { textDecorationColor: COLOR_ANOTACION[datos.color].linea }}>Aa</span>
            <span className="sr-only">{NOMBRE_ESTILO_ANOTACION[e]}</span>
          </button>
        ))}
      </div>

      {editando ? (
        <div className="space-y-2">
          <label className="sr-only" htmlFor="nota-resaltado">Nota del fragmento</label>
          <textarea id="nota-resaltado" value={nota} onChange={(e) => setNota(e.target.value)} rows={4}
                    placeholder="Escribe tu nota…" aria-invalid={exceso || undefined}
                    className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" />
          <div className="flex items-center justify-between gap-2">
            {/* El contador se pone rojo al pasarse; el servidor lo vuelve a comprobar (RN-85). */}
            <span className={cn("text-xs tabular-nums", exceso ? "text-danger-texto" : "text-muted-foreground")}>
              {largo(nota.trim())} / {maxNota}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setEditando(false)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-muted">Cancelar</button>
              <button type="button" disabled={guardando || exceso} onClick={() => alGuardarNota(nota)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" disabled={guardando} onClick={() => setEditando(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
            <HugeiconsIcon icon={NoteEditIcon} className="size-4" aria-hidden="true" />
            {datos.nota ? "Editar nota" : "Agregar nota"}
          </button>
          {datos.existente && (
            <button type="button" disabled={guardando} onClick={alBorrar}
                    className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-danger-texto hover:bg-danger-suave">
              <HugeiconsIcon icon={Delete02Icon} className="size-4" aria-hidden="true" />
              Borrar
            </button>
          )}
        </div>
      )}
      {/* La nota guardada, a la vista mientras no se edita. whitespace-pre-wrap: respeta los saltos de línea. Es TEXTO:
          React lo escapa, nunca se interpreta como HTML (RN-87). */}
      {datos.nota && !editando && (
        <p className="max-h-28 overflow-y-auto rounded-xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{datos.nota}</p>
      )}
    </div>
  );
}
