// foliate-js 1.0.1 es JavaScript sin tipos. Sin esta declaración, TypeScript (modo estricto) rechaza el import.
// Declara SOLO lo que usa el visor EPUB (components/visor-epub*), leído de node_modules/foliate-js/view.js,
// paginator.js y epub.js: si se usa algo más, hay que agregarlo aquí después de comprobarlo en el código de la librería.
// Un archivo .d.ts no genera código: solo describe la forma de lo que ya existe.

declare module "foliate-js/view.js" {
  // El paginador (<foliate-paginator>) que dibuja el libro. setStyles: CSS que se inyecta en cada capítulo.
  // Atributos que lee (paginator.js, observedAttributes): flow, gap, margin, max-inline-size, max-column-count…
  export interface Paginador extends HTMLElement {
    setStyles(css: string): void;
    next(): Promise<void>;
  }

  // Una entrada del índice (EPUB 3: nav.xhtml; EPUB 2: toc.ncx). href: archivo del capítulo y, opcional, #ancla.
  export interface EntradaToc {
    label: string;
    href: string;
    subitems?: EntradaToc[] | null;
  }

  // Lo que se usa del libro abierto (epub.js, clase EPUB).
  export interface Libro {
    toc?: EntradaToc[];
    // Cada capítulo del spine. size: bytes (se usa para el progreso); linear "no": fuera de la lectura seguida.
    sections: { size: number; linear?: string }[];
    // href del índice → índice de la sección en `sections` (null si no existe).
    resolveHref(href: string): { index: number } | null;
  }

  // <foliate-view>: importar el módulo registra el elemento (customElements.define).
  // Eventos: "relocate" (detail: { fraction, location: { current, total }, tocItem }), "load" (detail: { doc } del
  // capítulo cargado) y "external-link" (cancelable; si nadie lo cancela, la librería abre el enlace con window.open).
  export class View extends HTMLElement {
    book: Libro;
    renderer: Paginador;
    open(libro: File): Promise<void>;
    close(): void;
    goTo(destino: string): Promise<void>;
    // goLeft/goRight: según el sentido del libro (en uno de derecha a izquierda, "izquierda" es avanzar).
    goLeft(): Promise<void>;
    goRight(): Promise<void>;
    // next/prev: avanzar o retroceder en el orden de lectura, sin importar el sentido.
    next(): Promise<void>;
    prev(): Promise<void>;
  }
}
