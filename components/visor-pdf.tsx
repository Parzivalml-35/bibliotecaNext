"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { buttonVariants } from "@/components/ui/button";

// RN-29: visor propio. pdf.js dibuja cada página en un <canvas>: no hay barra del visor del navegador con
// "Descargar" o "Imprimir", ni un enlace al archivo. Client Component porque usa el navegador (canvas, fetch,
// Web Worker) y estado (página actual).
export function VisorPdf({ url, titulo }: { url: string; titulo: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // 1) Cargar pdf.js y el archivo. import() dinámico: pdf.js solo existe en el navegador, así que no entra en
  // el render del servidor. El worker (otro hilo) interpreta el PDF sin congelar la página.
  useEffect(() => {
    let cancelado = false;
    let cargado: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(
          new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
          { type: "module" },
        );
        // fetch() lleva la cookie de sesión (mismo origen) y manda Sec-Fetch-Dest: empty, lo que exige la ruta.
        const respuesta = await fetch(url, { cache: "no-store" });
        if (!respuesta.ok) throw new Error(await respuesta.text());
        const datos = new Uint8Array(await respuesta.arrayBuffer());
        cargado = await pdfjs.getDocument({ data: datos }).promise;
        if (cancelado) await cargado.loadingTask.destroy();
        else setDocumento(cargado);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error && e.message ? e.message : "No se pudo abrir el libro.");
      }
    })();
    return () => {
      cancelado = true;
      void cargado?.loadingTask.destroy(); // libera la memoria del documento al salir de la página
    };
  }, [url]);

  // 2) Dibujar la página actual al ancho del contenedor. Se cancela el dibujo anterior si se cambia rápido.
  useEffect(() => {
    if (!documento || !lienzo.current || !contenedor.current) return;
    let tarea: RenderTask | null = null;
    let cancelado = false;
    (async () => {
      const hoja = await documento.getPage(pagina);
      if (cancelado || !lienzo.current || !contenedor.current) return;
      const base = hoja.getViewport({ scale: 1 });
      const escala = Math.min(contenedor.current.clientWidth / base.width, 2);
      const vista = hoja.getViewport({ scale: escala });
      const densidad = window.devicePixelRatio || 1; // nitidez en pantallas de alta densidad
      lienzo.current.width = Math.floor(vista.width * densidad);
      lienzo.current.height = Math.floor(vista.height * densidad);
      lienzo.current.style.width = `${Math.floor(vista.width)}px`;
      lienzo.current.style.height = `${Math.floor(vista.height)}px`;
      tarea = hoja.render({ canvas: lienzo.current, viewport: vista, transform: densidad === 1 ? undefined : [densidad, 0, 0, densidad, 0, 0] });
      await tarea.promise.catch(() => {}); // cancelar lanza un error esperado
    })();
    return () => {
      cancelado = true;
      tarea?.cancel();
    };
  }, [documento, pagina]);

  // Flechas del teclado para pasar página.
  useEffect(() => {
    const total = documento?.numPages ?? 0;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPagina((p) => Math.min(p + 1, total));
      if (e.key === "ArrowLeft") setPagina((p) => Math.max(p - 1, 1));
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [documento]);

  if (error) return <p role="alert" className="rounded-2xl border border-danger/40 bg-danger-suave px-4 py-3 text-sm text-danger-texto">{error}</p>;
  const total = documento?.numPages ?? 0;
  const claseBoton = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={claseBoton} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
        {/* aria-live: el lector de pantalla anuncia el cambio de página */}
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {documento ? `Página ${pagina} de ${total}` : "Abriendo el libro…"}
        </p>
        <button type="button" className={claseBoton} disabled={!documento || pagina >= total} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
      </div>
      {/* El fondo lo pone la página (bg-muted): aquí solo se centra la hoja. */}
      <div ref={contenedor} className="flex justify-center">
        {/* onContextMenu: sin el menú "Guardar imagen como…" sobre la página. Es una molestia, no una protección. */}
        <canvas ref={lienzo} role="img" aria-label={`${titulo}, página ${pagina}`} onContextMenu={(e) => e.preventDefault()}
                // DI-06: el PDF es una imagen dibujada, no toma los colores del tema. En la lámpara se aproxima con un
                // filtro sobre el canvas: in-data-[tema=lampara] = "si algún ancestro tiene data-tema=lampara".
                // sepia-40 tiñe hacia el café; brightness-95 baja un poco el blanco del papel.
                className="max-w-full rounded-sm border border-border bg-white in-data-[tema=lampara]:sepia-40 in-data-[tema=lampara]:brightness-95" />
      </div>
    </div>
  );
}
