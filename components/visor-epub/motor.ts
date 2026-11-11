"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import type { EntradaToc, Libro, View } from "foliate-js/view.js";

// El MOTOR del visor EPUB (foliate-js), separado de la interfaz. Abre el libro dentro de `contenedor` y entrega datos
// neutros (índice, progreso) y acciones (ir, avanzar, retroceder). La interfaz (components/visor-epub.tsx y
// components/visor-epub/*) no conoce los objetos de foliate-js: si algún día se cambia de motor (DI-06, Readium), se
// reescribe este archivo y la interfaz sigue igual.
//
// SEGURIDAD (RN-84). foliate-js NO bloquea el JavaScript del libro: dibuja cada capítulo en un <iframe> con
// sandbox="allow-same-origin allow-scripts" (bug de WebKit) y src blob: de nuestro origen. Lo bloquea la CSP que
// proxy.ts pone en /leer/<isbn>. Pero la CSP es una cabecera del DOCUMENTO: si se llegó aquí con una navegación del
// cliente (p. ej. el redirect() del login con ?siguiente=), el documento es el de la página anterior, sin CSP.
// Por eso, antes de abrir nada, se comprueba en qué URL se cargó el documento; si no es esta, se recarga.

// Una entrada del índice, ya con su página. nivel: 0 para los capítulos, 1 para sus subcapítulos, etc.
// pagina: null si el destino no está en el libro (índice mal armado).
export type EntradaIndice = { titulo: string; destino: string; pagina: number | null; nivel: number };
// Dónde va el lector. pagina/total son "ubicaciones" de 1500 bytes (las de foliate-js): no son páginas impresas,
// pero no cambian con el tamaño de la pantalla, así que sirven para ubicarse. capitulo/destino: la entrada del
// índice en la que está (null antes del primer capítulo).
export type Progreso = { capitulo: string | null; destino: string | null; pagina: number; total: number; fraccion: number };
// Ajustes de lectura de este navegador: tamaño de letra en % y cuántas columnas como máximo (2 solo si caben).
export type AjustesLectura = { letra: number; columnas: 1 | 2 };

// foliate-js (view.js: new SectionProgress(book.sections, 1500, 1600)) cuenta una "ubicación" cada 1500 bytes de texto.
const BYTES_POR_UBICACION = 1500;
// Rueda y touchpad: un gesto del touchpad dispara decenas de eventos seguidos. Se ignoran los movimientos mínimos y,
// después de pasar una página, los eventos de los siguientes PAUSA_RUEDA ms (si no, un gesto saltaría varias).
const MINIMO_RUEDA = 4;
const PAUSA_RUEDA = 450;

// ¿El documento se cargó (navegación completa) en esta misma ruta? performance.getEntriesByType("navigation") describe
// la carga del documento actual y no cambia con las navegaciones del cliente.
function documentoCargadoAqui(): boolean {
  const [carga] = performance.getEntriesByType("navigation");
  return !!carga && new URL(carga.name).pathname === location.pathname;
}

// El CSS que se inyecta en cada capítulo: los colores del tema activo y el tamaño de letra elegido.
// Los colores del tema activo para el texto del libro (DI-06). Las variables CSS están en <html> (globals.css) y cambian
// con data-tema; los capítulos viven en iframes, que no las heredan: se leen aquí y se escriben en su CSS.
// Fondo TRANSPARENTE: se ve el fondo del contenedor, que ya sigue el tema. (foliate-js pinta los márgenes con el fondo
// que lee del capítulo al cargarlo y no lo vuelve a leer: con un color fijo, al cambiar de tema el marco quedaba con el
// color anterior.)
function estiloDelLibro(ajustes: AjustesLectura): string {
  const raiz = getComputedStyle(document.documentElement);
  const v = (nombre: string) => raiz.getPropertyValue(nombre).trim();
  // color-scheme IGUAL al de la página: si el iframe y la página no coinciden, el navegador pinta el iframe con un
  // fondo opaco (blanco o negro) y el fondo transparente no sirve. Se copia el que la página tiene calculado.
  return `
    html { color-scheme: ${raiz.colorScheme || "normal"}; }
    html, body { background: transparent !important; color: ${v("--foreground")} !important; }
    a:link, a:visited { color: ${v("--primary")} !important; }
    p, li, blockquote { line-height: 1.6; hyphens: auto; }
    /* Tamaño de letra: sobre <html>, así escala todo lo que el libro mide en em o rem (los px quedan igual). */
    html { font-size: ${ajustes.letra}% !important; }
  `;
}

// El índice del libro, aplanado (los subcapítulos quedan debajo de su capítulo, con nivel + 1) y con la página donde
// empieza cada entrada: la misma cuenta que hace foliate-js para location.current (bytes de las secciones lineales
// anteriores / 1500). Para un subcapítulo que empieza a mitad de una sección, es la página de inicio de esa sección.
function indiceDe(libro: Libro): EntradaIndice[] {
  const tamanos = libro.sections.map((s) => (s.linear !== "no" && s.size > 0 ? s.size : 0));
  const antes: number[] = [];
  tamanos.reduce((acumulado, t, i) => ((antes[i] = acumulado), acumulado + t), 0);

  const salida: EntradaIndice[] = [];
  const recorrer = (entradas: EntradaToc[], nivel: number) => {
    for (const e of entradas) {
      const indice = libro.resolveHref(e.href)?.index ?? -1;
      salida.push({
        titulo: e.label?.trim() || "(sin título)",
        destino: e.href,
        pagina: indice >= 0 ? Math.floor(antes[indice] / BYTES_POR_UBICACION) + 1 : null,
        nivel,
      });
      if (e.subitems?.length) recorrer(e.subitems, nivel + 1);
    }
  };
  recorrer(libro.toc ?? [], 0);
  return salida;
}

// contenedor: donde se monta el libro. superficie: lo que lo envuelve junto con los controles que van encima (las zonas
// laterales); ahí se escucha la rueda, para que funcione también con el puntero sobre esos controles.
export function useLibroEpub(
  url: string,
  contenedor: RefObject<HTMLDivElement | null>,
  superficie: RefObject<HTMLElement | null>,
  ajustes: AjustesLectura,
) {
  const vista = useRef<View | null>(null);
  // Los ajustes vigentes, para quien los lee "después" (al abrir el libro, al cambiar el tema). Una ref y no una
  // dependencia del efecto principal: cambiar la letra NO debe cerrar y volver a abrir el libro.
  const ajustesVigentes = useRef(ajustes);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indice, setIndice] = useState<EntradaIndice[]>([]);
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  // Cambio de ajustes con el libro abierto: se aplican en el momento. Va ANTES del efecto principal: los efectos corren
  // en orden, así la ref ya tiene los ajustes guardados cuando el principal abre el libro.
  useEffect(() => {
    ajustesVigentes.current = ajustes;
    const v = vista.current;
    if (!v || !listo) return;
    v.renderer.setAttribute("max-column-count", String(ajustes.columnas));
    v.renderer.setStyles(estiloDelLibro(ajustes));
  }, [ajustes, listo]);

  useEffect(() => {
    if (!documentoCargadoAqui()) {
      location.reload(); // navegación completa: ahora sí llega la CSP de proxy.ts
      return;
    }
    let cancelado = false;
    let abierta: View | null = null;
    let ultimoGiro = 0;
    // El tema puede cambiar mientras se lee (botón flotante, lámpara): un MutationObserver sobre <html> vuelve a
    // escribir los colores en el libro.
    const observador = new MutationObserver(() => abierta?.renderer.setStyles(estiloDelLibro(ajustesVigentes.current)));

    // Flechas: goLeft/goRight respetan los libros de derecha a izquierda.
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") void abierta?.goLeft();
      if (e.key === "ArrowRight") void abierta?.goRight();
    }
    // Rueda: hacia abajo (o hacia la derecha en el touchpad) avanza. next/prev siguen el orden de lectura.
    // preventDefault: que la rueda no desplace también la página. Por eso se registra con { passive: false }.
    function alGirar(e: WheelEvent) {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < MINIMO_RUEDA) return;
      e.preventDefault();
      const ahora = performance.now();
      if (ahora - ultimoGiro < PAUSA_RUEDA) return;
      ultimoGiro = ahora;
      void (delta > 0 ? abierta?.next() : abierta?.prev());
    }

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
        v.style.display = "block";
        v.style.height = "100%";
        contenedor.current.append(v);
        v.addEventListener("relocate", (e) => {
          const d = (e as CustomEvent<{ fraction: number; location?: { current: number; total: number };
            tocItem?: { label?: string; href?: string } }>).detail;
          setProgreso({
            capitulo: d.tocItem?.label?.trim() || null,
            destino: d.tocItem?.href ?? null,
            pagina: (d.location?.current ?? 0) + 1,
            total: d.location?.total ?? 0,
            fraccion: d.fraction,
          });
        });
        // Cada capítulo es OTRO documento (un iframe): el teclado y la rueda que ocurren dentro no llegan a la página.
        v.addEventListener("load", (e) => {
          const { doc } = (e as CustomEvent<{ doc: Document }>).detail;
          doc.addEventListener("keydown", alPresionar);
          doc.addEventListener("wheel", alGirar, { passive: false });
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
        v.renderer.setAttribute("max-column-count", String(ajustesVigentes.current.columnas));
        v.renderer.setStyles(estiloDelLibro(ajustesVigentes.current));
        observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-tema-base"] });
        setIndice(indiceDe(v.book));
        await v.renderer.next(); // muestra la primera página
        setListo(true);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error && e.message ? e.message : "No se pudo abrir el libro.");
      }
    })();

    // La rueda fuera de los iframes (márgenes y zonas laterales). Se toma el elemento al montar: la limpieza tiene que
    // quitar el listener del MISMO elemento, aunque la ref cambie después.
    const caja = superficie.current;
    window.addEventListener("keydown", alPresionar);
    caja?.addEventListener("wheel", alGirar, { passive: false });

    return () => {
      cancelado = true;
      observador.disconnect();
      window.removeEventListener("keydown", alPresionar);
      caja?.removeEventListener("wheel", alGirar);
      abierta?.close(); // libera los capítulos y sus blob:
      abierta?.remove();
      vista.current = null;
    };
  }, [url, contenedor, superficie]);

  return {
    listo,
    error,
    indice,
    progreso,
    ir: (destino: string) => void vista.current?.goTo(destino),
    // Los botones y las zonas laterales son "izquierda" y "derecha" en pantalla: respetan el sentido del libro.
    izquierda: () => void vista.current?.goLeft(),
    derecha: () => void vista.current?.goRight(),
  };
}
