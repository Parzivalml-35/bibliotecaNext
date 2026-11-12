"use client";

import { LeftToRightListBulletIcon, SidebarLeft01Icon, TextFontIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { EnlaceLogo } from "@/components/marca/enlace-logo";
import { Button } from "@/components/ui/button";
import type { FichaLibro } from "@/components/visor";
import { AjustesDeLectura } from "@/components/visor-epub/ajustes-lectura";
import { BotonDetalles, PortadaAmpliable } from "@/components/visor-epub/dialogos-libro";
import { IndiceLibro } from "@/components/visor-epub/indice-libro";
import type { AjustesLectura, EntradaIndice, Progreso } from "@/components/visor-epub/motor";
import { cn } from "@/lib/utils";

// Las pestañas del pie (como en Readest). La fase de anotaciones NO agrega aquí: sus notas van en un panel a la derecha.
const PESTANAS = [
  { id: "indice", nombre: "Índice", icono: LeftToRightListBulletIcon },
  { id: "ajustes", nombre: "Ajustes", icono: TextFontIcon },
] as const;
type Pestana = (typeof PESTANAS)[number]["id"];

// La barra lateral del visor EPUB (idea de Readest; código nuestro): arriba los controles, la ficha del libro, el
// índice con su propio scroll y, al pie, el avance. La misma barra se usa fija en el escritorio y dentro del cajón en el
// celular: lo que cambia lo dicen alOcultar (solo en el escritorio) y alElegir (en el celular, además cierra el cajón).
export function BarraLateral({ ficha, portada, detalles, indice, progreso, ajustes, alCambiarAjustes, alElegir, alOcultar }: {
  ficha: FichaLibro;
  portada: ReactNode;
  detalles: ReactNode;
  indice: EntradaIndice[];
  progreso: Progreso | null;
  ajustes: AjustesLectura;
  alCambiarAjustes: (nuevos: AjustesLectura) => void;
  alElegir: (destino: string) => void;
  alOcultar?: () => void;
}) {
  const porcentaje = progreso ? Math.round(progreso.fraccion * 100) : 0;
  const [pestana, setPestana] = useState<Pestana>("indice");
  // useId: ids únicos para unir cada pestaña con su panel (aria-controls / aria-labelledby). La barra existe dos veces
  // (fija y en el cajón): ids escritos a mano se repetirían en la página.
  const base = useId();

  // Patrón de pestañas de WAI-ARIA: Tab entra a la pestaña activa (las demás tienen tabIndex -1) y las flechas
  // izquierda/derecha se mueven entre pestañas, activándolas.
  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = PESTANAS.findIndex((p) => p.id === pestana);
    const siguiente = PESTANAS[(i + (e.key === "ArrowRight" ? 1 : PESTANAS.length - 1)) % PESTANAS.length];
    setPestana(siguiente.id);
    document.getElementById(`${base}-tab-${siguiente.id}`)?.focus();
  }

  return (
    // h-full + flex-col: la ficha y el pie miden lo suyo y el índice (flex-1 min-h-0 overflow-y-auto) toma el resto
    // con su propio scroll. min-h-0: sin él, un hijo flex no se encoge por debajo de su contenido y no habría scroll.
    <div className="flex h-full flex-col">
      {/* Fila superior (pedido del usuario, 2026-11-12): el emblema y Volver a la izquierda; a la derecha, el botón para
          ocultar la barra (en el cajón del celular no hace falta: se cierra tocando fuera). La lámpara pasó a la fila de
          lectura, arriba a la derecha. */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <EnlaceLogo className="ml-1" />
        {/* Salir del visor sí puede ser <Link>: la CSP de RN-84 importa al ENTRAR a /leer, no al salir. */}
        <Link href={`/libros/${ficha.isbn}`} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          ← Volver
        </Link>
        <div className="flex-1" />
        {alOcultar && (
          <Button type="button" variant="ghost" size="icon" onClick={alOcultar}>
            <HugeiconsIcon icon={SidebarLeft01Icon} aria-hidden="true" />
            <span className="sr-only">Ocultar el panel del libro</span>
          </Button>
        )}
      </div>

      <div className="flex gap-3 border-b border-border px-4 pt-2 pb-4">
        {/* Clic en la portada: se ve en grande. (i): detalles del libro. */}
        <PortadaAmpliable ficha={ficha} portada={portada} />
        <div className="min-w-0 flex-1">
          {/* line-clamp-2: un título largo ocupa hasta dos líneas y termina en "…". */}
          <p className="line-clamp-2 font-heading font-semibold">{ficha.titulo}</p>
          <p className="truncate text-sm text-muted-foreground">{ficha.autores}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ficha.acceso}</p>
          {ficha.otroFormato && (
            // <a> y no <Link> (RN-84): cambiar de formato vuelve a entrar a /leer y necesita su CSP.
            <a href={ficha.otroFormato.href} className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">
              Ver en {ficha.otroFormato.nombre}
            </a>
          )}
        </div>
        <BotonDetalles ficha={ficha} portada={portada} detalles={detalles} />
      </div>

      {/* El panel de la pestaña activa, con su propio scroll. */}
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${pestana}`} className="min-h-0 flex-1 overflow-y-auto">
        {pestana === "indice"
          ? <IndiceLibro indice={indice} progreso={progreso} alElegir={alElegir} />
          : <AjustesDeLectura ajustes={ajustes} alCambiar={alCambiarAjustes} />}
      </div>

      {/* El avance en el libro. role="progressbar" con sus aria-value*: el lector de pantalla lo lee como una barra. */}
      <div className="border-t border-border px-4 py-3">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>Leído</span>
          <span>{porcentaje} %</span>
        </div>
        <div role="progressbar" aria-label="Avance en el libro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje}
             className="h-1.5 overflow-hidden rounded-full bg-muted">
          {/* El ancho calculado va en style: Tailwind no puede generar una clase por cada porcentaje. */}
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${porcentaje}%` }} />
        </div>
      </div>

      {/* Las pestañas, al pie (como en Readest). */}
      <div role="tablist" aria-label="Contenido del panel" onKeyDown={alTeclear} className="grid grid-cols-2 gap-1 border-t border-border p-2">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" id={`${base}-tab-${p.id}`} aria-controls={`${base}-panel`}
                  aria-selected={pestana === p.id} tabIndex={pestana === p.id ? 0 : -1} onClick={() => setPestana(p.id)}
                  className={cn("flex items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    pestana === p.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60")}>
            <HugeiconsIcon icon={p.icono} className="size-4" aria-hidden="true" />
            {p.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
