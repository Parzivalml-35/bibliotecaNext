"use client";

import { SidebarLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { FichaLibro } from "@/components/visor";
import { BarraLateral } from "@/components/visor-epub/barra-lateral";
import { useLibroEpub } from "@/components/visor-epub/motor";
import { usePreferencia } from "@/components/visor-epub/preferencias";

// RN-29, RN-84, DI-06: la INTERFAZ del visor EPUB, a casi pantalla completa (idea de Readest; código nuestro).
// El motor (foliate-js, la comprobación de la CSP, el tema, la rueda) está en components/visor-epub/motor.ts; aquí solo
// se dibuja con los datos neutros que entrega. No lo usan las páginas directamente: van por <Visor>.
//
// Escritorio (lg, 1024 px o más): la barra lateral fija a la izquierda, que se oculta y se muestra (se recuerda en este
// navegador). Celular: la barra es un cajón (Sheet) que se abre encima del libro.

const esSiNo = (v: string) => (v === "si" || v === "no" ? v : null);

export function VisorEpub({ url, ficha, portada }: { url: string; ficha: FichaLibro; portada: ReactNode }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const superficie = useRef<HTMLDivElement>(null);
  const { listo, error, indice, progreso, ir, izquierda, derecha } = useLibroEpub(url, contenedor, superficie);
  const [barraOculta, setBarraOculta] = usePreferencia("visor-epub:barra-oculta", "no", esSiNo);
  const [cajonAbierto, setCajonAbierto] = useState(false);

  const barra = (enCajon: boolean) => (
    <BarraLateral ficha={ficha} portada={portada} indice={indice} progreso={progreso}
                  // En el cajón, elegir un capítulo también lo cierra: si no, taparía la página a la que se saltó.
                  alElegir={(destino) => { ir(destino); if (enCajon) setCajonAbierto(false); }}
                  alOcultar={enCajon ? undefined : () => setBarraOculta("si")} />
  );

  return (
    // h-dvh: el alto visible de la pantalla (dvh: en el celular, sin la barra del navegador). bg-card tapa la pared con
    // su luz (DI-14): aquí manda el libro. El botón flotante de sol y luna (DI-03) sigue encima, en su esquina.
    <div className="flex h-dvh w-full bg-card print:hidden">
      {barraOculta === "no" && (
        // hidden lg:flex: en el celular esta barra no existe (está el cajón). w-72 = 18 rem; shrink-0: no se encoge.
        <aside aria-label="Libro e índice" className="hidden w-72 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
          {barra(false)}
        </aside>
      )}

      {/* El cajón del celular. Controlado (open/onOpenChange) para poder cerrarlo desde el índice. */}
      <Sheet open={cajonAbierto} onOpenChange={setCajonAbierto}>
        <SheetContent side="left" showCloseButton={false} className="w-80 p-0">
          {/* Radix exige un título en todo diálogo (lo anuncia el lector de pantalla); sr-only: no se ve. */}
          <SheetTitle className="sr-only">Libro e índice</SheetTitle>
          {barra(true)}
        </SheetContent>
      </Sheet>

      {/* min-w-0: sin él, un hijo flex no se encoge por debajo del ancho de su contenido (el libro desbordaría). */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 items-center gap-2 px-3">
          {/* Abrir la barra: en el celular abre el cajón; en el escritorio, solo si está oculta. */}
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setCajonAbierto(true)}>
            <HugeiconsIcon icon={SidebarLeft01Icon} aria-hidden="true" />
            <span className="sr-only">Abrir el panel del libro</span>
          </Button>
          {barraOculta === "si" && (
            <Button type="button" variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setBarraOculta("no")}>
              <HugeiconsIcon icon={SidebarLeft01Icon} aria-hidden="true" />
              <span className="sr-only">Mostrar el panel del libro</span>
            </Button>
          )}
          {/* El capítulo en curso, como el encabezado de página de un libro impreso. */}
          <p className="min-w-0 flex-1 truncate text-xs tracking-wide text-muted-foreground uppercase">
            {error ? "" : listo ? (progreso?.capitulo ?? "") : "Abriendo el libro…"}
          </p>
        </div>

        {error ? (
          <p role="alert" className="m-4 rounded-2xl border border-danger/40 bg-danger-suave px-4 py-3 text-sm text-danger-texto">{error}</p>
        ) : (
          // flex-1 min-h-0: toma todo el alto que queda (el libro se pagina dentro). relative: las zonas laterales van
          // encima con absolute. ref superficie: el motor escucha la rueda aquí, que envuelve al libro Y a las zonas.
          <div ref={superficie} className="relative min-h-0 flex-1">
            <div ref={contenedor} role="document" aria-label={ficha.titulo} onContextMenu={(e) => e.preventDefault()}
                 className="h-full" />
            {/* Zonas laterales: un clic en el borde pasa la página. <button> con nombre (lector de pantalla, Tab),
                transparentes y del 10 % del ancho: quedan sobre el margen, no sobre el texto. */}
            <button type="button" aria-label="Página anterior" disabled={!listo} onClick={izquierda}
                    className="absolute inset-y-0 left-0 w-[10%] cursor-w-resize focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default" />
            <button type="button" aria-label="Página siguiente" disabled={!listo} onClick={derecha}
                    className="absolute inset-y-0 right-0 w-[10%] cursor-e-resize focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default" />
          </div>
        )}

        {/* Contador de ubicaciones (las de foliate-js: no cambian con el tamaño de la pantalla). aria-live: el lector de
            pantalla anuncia el avance. pr-20: deja libre la esquina del botón flotante de sol y luna (DI-03). */}
        <p aria-live="polite" className="flex h-11 items-center justify-end pr-20 text-xs text-muted-foreground tabular-nums">
          {listo && progreso ? (
            <>
              <span className="sr-only">Ubicación </span>
              {progreso.pagina} / {progreso.total}
              <span className="sr-only">, {Math.round(progreso.fraccion * 100)} % del libro</span>
            </>
          ) : null}
        </p>
      </main>
    </div>
  );
}
