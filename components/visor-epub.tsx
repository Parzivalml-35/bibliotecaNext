"use client";

import { useEffect, useRef, useState } from "react";
import type { View } from "foliate-js/view.js";
import { buttonVariants } from "@/components/ui/button";

// RN-29, RN-84, DI-06: visor EPUB con foliate-js. Client Component por lo mismo que VisorPdf: usa el navegador
// (fetch, iframes, custom elements) y estado (progreso). No lo usan las páginas directamente: van por <Visor>.
//
// SEGURIDAD (RN-84). foliate-js NO bloquea el JavaScript del libro: dibuja cada capítulo en un <iframe> con
// sandbox="allow-same-origin allow-scripts" (bug de WebKit) y src blob: de nuestro origen. Lo bloquea la CSP que
// proxy.ts pone en /leer/<isbn>. Pero la CSP es una cabecera del DOCUMENTO: si se llegó aquí con una navegación del
// cliente (p. ej. el redirect() del login con ?siguiente=), el documento es el de la página anterior, sin CSP.
// Por eso, antes de abrir nada, se comprueba en qué URL se cargó el documento; si no es esta, se recarga.

// ¿El documento se cargó (navegación completa) en esta misma ruta? performance.getEntriesByType("navigation") describe
// la carga del documento actual y no cambia con las navegaciones del cliente.
function documentoCargadoAqui(): boolean {
  const [carga] = performance.getEntriesByType("navigation");
  return !!carga && new URL(carga.name).pathname === location.pathname;
}

// Los colores del tema activo para el texto del libro (DI-06). Las variables CSS están en <html> (globals.css) y cambian
// con data-tema; los capítulos viven en iframes, que no las heredan: se leen aquí y se escriben en su CSS.
// Fondo TRANSPARENTE: se ve el bg-card del contenedor, que ya sigue el tema. (foliate-js pinta los márgenes con el
// fondo que lee del capítulo al cargarlo y no lo vuelve a leer: con un color fijo, al cambiar de tema el marco
// quedaba con el color anterior.)
function estiloDelTema(): string {
  const raiz = getComputedStyle(document.documentElement);
  const v = (nombre: string) => raiz.getPropertyValue(nombre).trim();
  // color-scheme IGUAL al de la página: si el iframe y la página no coinciden, el navegador pinta el iframe con un
  // fondo opaco (blanco o negro) y el fondo transparente no sirve. Se copia el que la página tiene calculado.
  return `
    html { color-scheme: ${raiz.colorScheme || "normal"}; }
    html, body { background: transparent !important; color: ${v("--foreground")} !important; }
    a:link, a:visited { color: ${v("--primary")} !important; }
    p, li, blockquote { line-height: 1.6; hyphens: auto; }
  `;
}

export function VisorEpub({ url, titulo }: { url: string; titulo: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const vista = useRef<View | null>(null);
  const [listo, setListo] = useState(false);
  const [progreso, setProgreso] = useState<{ fraccion: number; capitulo: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1) Comprobar la CSP, cargar foliate-js y el archivo, y abrir el libro.
  useEffect(() => {
    if (!documentoCargadoAqui()) {
      location.reload(); // navegación completa: ahora sí llega la CSP de proxy.ts
      return;
    }
    let cancelado = false;
    let abierta: View | null = null;
    // El tema puede cambiar mientras se lee (botón flotante, lámpara): un MutationObserver sobre <html> vuelve a
    // escribir los colores en el libro.
    const observador = new MutationObserver(() => abierta?.renderer.setStyles(estiloDelTema()));

    (async () => {
      try {
        // fetch() lleva la cookie de sesión y manda Sec-Fetch-Dest: empty, lo que exige la ruta (RN-29).
        const respuesta = await fetch(url, { cache: "no-store" });
        if (!respuesta.ok) throw new Error(await respuesta.text());
        // foliate-js recibe un File: reconoce el EPUB por su contenido (empieza por "PK", es un ZIP).
        const archivo = new File([await respuesta.blob()], "libro.epub", { type: "application/epub+zip" });
        // import() dinámico: foliate-js solo existe en el navegador (define un custom element), así que no entra en
        // el render del servidor. Importarlo registra <foliate-view>.
        await import("foliate-js/view.js");
        if (cancelado || !contenedor.current) return;

        const v = document.createElement("foliate-view") as View;
        abierta = v;
        vista.current = v;
        // El texto del libro, en una columna de lectura cómoda (máximo 720 px), con margen entre páginas.
        v.style.display = "block";
        v.style.height = "100%";
        contenedor.current.append(v);
        v.addEventListener("relocate", (e) => {
          const { fraction, tocItem } = (e as CustomEvent<{ fraction: number; tocItem?: { label?: string } }>).detail;
          setProgreso({ fraccion: fraction, capitulo: tocItem?.label?.trim() || null });
        });
        // Las flechas también tienen que funcionar con el foco DENTRO del capítulo (cada uno es otro documento).
        v.addEventListener("load", (e) => {
          (e as CustomEvent<{ doc: Document }>).detail.doc.addEventListener("keydown", alPresionar);
        });
        // Enlaces a otros sitios: foliate-js los abriría con window.open(href, "_blank"), y la página abierta tendría
        // window.opener apuntando aquí (tabnabbing). Se cancela y se abre con noopener, solo si es http(s).
        v.addEventListener("external-link", (e) => {
          e.preventDefault();
          const { href } = (e as CustomEvent<{ href: string }>).detail;
          if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
        });

        await v.open(archivo);
        if (cancelado) return;
        v.renderer.setAttribute("flow", "paginated");
        v.renderer.setAttribute("max-inline-size", "720px");
        v.renderer.setAttribute("gap", "6%");
        v.renderer.setStyles(estiloDelTema());
        observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-tema-base"] });
        await v.renderer.next(); // muestra la primera página
        setListo(true);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error && e.message ? e.message : "No se pudo abrir el libro.");
      }
    })();

    // Flechas del teclado en la página (fuera del libro). goLeft/goRight respetan los libros de derecha a izquierda.
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") void vista.current?.goLeft();
      if (e.key === "ArrowRight") void vista.current?.goRight();
    }
    window.addEventListener("keydown", alPresionar);

    return () => {
      cancelado = true;
      observador.disconnect();
      window.removeEventListener("keydown", alPresionar);
      abierta?.close(); // libera los capítulos y sus blob:
      abierta?.remove();
      vista.current = null;
    };
  }, [url]);

  if (error) return <p role="alert" className="rounded-2xl border border-danger/40 bg-danger-suave px-4 py-3 text-sm text-danger-texto">{error}</p>;
  const claseBoton = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={claseBoton} disabled={!listo} onClick={() => void vista.current?.goLeft()}>← Anterior</button>
        {/* aria-live: el lector de pantalla anuncia el avance. tabular-nums: los números no "bailan" al cambiar. */}
        <p aria-live="polite" className="min-w-0 truncate text-center text-sm text-muted-foreground tabular-nums">
          {!listo ? "Abriendo el libro…" : progreso
            ? `${progreso.capitulo ? `${progreso.capitulo} · ` : ""}${Math.round(progreso.fraccion * 100)} %`
            : ""}
        </p>
        <button type="button" className={claseBoton} disabled={!listo} onClick={() => void vista.current?.goRight()}>Siguiente →</button>
      </div>
      {/* La "hoja": alto fijo (el libro se pagina dentro), fondo de tarjeta como el texto del libro.
          h-[calc(100dvh-11rem)]: el alto de la pantalla (dvh: el visible en el celular, sin la barra del navegador)
          menos la barra del visor y los botones. min-h-96: nunca menos de 24 rem en pantallas muy bajas. */}
      <div ref={contenedor} role="document" aria-label={titulo} onContextMenu={(e) => e.preventDefault()}
           className="h-[calc(100dvh-11rem)] min-h-96 overflow-hidden rounded-2xl border border-border bg-card" />
    </div>
  );
}
