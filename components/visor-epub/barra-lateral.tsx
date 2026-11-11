"use client";

import { SidebarLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BotonLampara } from "@/components/boton-lampara";
import { Button } from "@/components/ui/button";
import type { FichaLibro } from "@/components/visor";
import { IndiceLibro } from "@/components/visor-epub/indice-libro";
import type { EntradaIndice, Progreso } from "@/components/visor-epub/motor";

// La barra lateral del visor EPUB (idea de Readest; código nuestro): arriba los controles, la ficha del libro, el
// índice con su propio scroll y, al pie, el avance. La misma barra se usa fija en el escritorio y dentro del cajón en el
// celular: lo que cambia lo dicen alOcultar (solo en el escritorio) y alElegir (en el celular, además cierra el cajón).
export function BarraLateral({ ficha, portada, indice, progreso, alElegir, alOcultar }: {
  ficha: FichaLibro;
  portada: ReactNode;
  indice: EntradaIndice[];
  progreso: Progreso | null;
  alElegir: (destino: string) => void;
  alOcultar?: () => void;
}) {
  const porcentaje = progreso ? Math.round(progreso.fraccion * 100) : 0;

  return (
    // h-full + flex-col: la ficha y el pie miden lo suyo y el índice (flex-1 min-h-0 overflow-y-auto) toma el resto
    // con su propio scroll. min-h-0: sin él, un hijo flex no se encoge por debajo de su contenido y no habría scroll.
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-2 pt-2">
        {alOcultar && (
          <Button type="button" variant="ghost" size="icon" onClick={alOcultar}>
            <HugeiconsIcon icon={SidebarLeft01Icon} aria-hidden="true" />
            <span className="sr-only">Ocultar el panel del libro</span>
          </Button>
        )}
        {/* Salir del visor sí puede ser <Link>: la CSP de RN-84 importa al ENTRAR a /leer, no al salir. */}
        <Link href={`/libros/${ficha.isbn}`} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          ← Volver
        </Link>
        <div className="flex-1" />
        <BotonLampara />
      </div>

      <div className="flex gap-3 border-b border-border px-4 pt-2 pb-4">
        <div className="w-12 shrink-0">{portada}</div>
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <IndiceLibro indice={indice} progreso={progreso} alElegir={alElegir} />
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
    </div>
  );
}
