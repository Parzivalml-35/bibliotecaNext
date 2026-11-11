"use client";

import { useRef } from "react";
import { useLibroEpub } from "@/components/visor-epub/motor";

// RN-29, RN-84, DI-06: la INTERFAZ del visor EPUB. El motor (foliate-js, la comprobación de la CSP, el tema, la rueda)
// está en components/visor-epub/motor.ts; aquí solo se dibuja con los datos neutros que entrega.
// No lo usan las páginas directamente: van por <Visor>.

export function VisorEpub({ url, titulo }: { url: string; titulo: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const superficie = useRef<HTMLDivElement>(null);
  const { listo, error, progreso, izquierda, derecha } = useLibroEpub(url, contenedor, superficie);

  if (error) return <p role="alert" className="rounded-2xl border border-danger/40 bg-danger-suave px-4 py-3 text-sm text-danger-texto">{error}</p>;

  return (
    <div className="space-y-2 print:hidden">
      {/* El capítulo en curso, como el encabezado de página de un libro impreso. */}
      <p className="h-4 truncate px-1 text-xs tracking-wide text-muted-foreground uppercase">
        {listo ? (progreso?.capitulo ?? "") : "Abriendo el libro…"}
      </p>
      {/* relative: las zonas laterales se ubican sobre el libro con absolute. ref superficie: el motor escucha la rueda
          aquí, que envuelve al libro Y a las zonas. */}
      <div ref={superficie} className="relative">
        {/* La "hoja": alto fijo (el libro se pagina dentro), fondo de tarjeta como el texto del libro.
            h-[calc(100dvh-12rem)]: el alto visible de la pantalla (dvh, sin la barra del navegador del celular) menos lo
            de arriba y abajo. min-h-96: nunca menos de 24 rem en pantallas muy bajas. */}
        <div ref={contenedor} role="document" aria-label={titulo} onContextMenu={(e) => e.preventDefault()}
             className="h-[calc(100dvh-12rem)] min-h-96 overflow-hidden rounded-2xl border border-border bg-card" />
        {/* Zonas laterales: un clic en el borde pasa la página, como en un lector de libros electrónicos. Son <button>
            (con nombre para el lector de pantalla y foco con Tab), transparentes y del 10 % del ancho: quedan sobre el
            margen, no sobre el texto. disabled hasta que el libro abre. */}
        <button type="button" aria-label="Página anterior" disabled={!listo} onClick={izquierda}
                className="absolute inset-y-0 left-0 w-[10%] cursor-w-resize rounded-l-2xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default" />
        <button type="button" aria-label="Página siguiente" disabled={!listo} onClick={derecha}
                className="absolute inset-y-0 right-0 w-[10%] cursor-e-resize rounded-r-2xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default" />
      </div>
      {/* Contador de ubicaciones (las de foliate-js: no cambian con el tamaño de la pantalla). aria-live: el lector de
          pantalla anuncia el avance. tabular-nums: los números no "bailan" al cambiar. pr-16: deja libre la esquina
          del botón flotante de sol y luna (DI-03). */}
      <p aria-live="polite" className="h-4 pr-16 text-right text-xs text-muted-foreground tabular-nums">
        {listo && progreso ? (
          <>
            <span className="sr-only">Ubicación </span>
            {progreso.pagina} / {progreso.total}
            <span className="sr-only">, {Math.round(progreso.fraccion * 100)} % del libro</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
