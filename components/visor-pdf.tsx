"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

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

  if (error) return <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  const total = documento?.numPages ?? 0;
  const claseBoton = "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={claseBoton} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
        {/* aria-live: el lector de pantalla anuncia el cambio de página */}
        <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          {documento ? `Página ${pagina} de ${total}` : "Abriendo el libro…"}
        </p>
        <button type="button" className={claseBoton} disabled={!documento || pagina >= total} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
      </div>
      <div ref={contenedor} className="flex justify-center rounded-lg border border-zinc-200 bg-zinc-100 p-2 dark:border-zinc-800 dark:bg-zinc-900">
        {/* onContextMenu: sin el menú "Guardar imagen como…" sobre la página. Es una molestia, no una protección. */}
        <canvas ref={lienzo} role="img" aria-label={`${titulo}, página ${pagina}`} onContextMenu={(e) => e.preventDefault()}
                className="max-w-full bg-white shadow" />
      </div>
    </div>
  );
}
