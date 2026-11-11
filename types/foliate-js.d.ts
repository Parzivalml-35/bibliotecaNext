// foliate-js 1.0.1 es JavaScript sin tipos. Sin esta declaración, TypeScript (modo estricto) rechaza el import.
// Declara SOLO lo que usa components/visor-epub.tsx (R8d), leído de node_modules/foliate-js/view.js y paginator.js:
// si se usa algo más, hay que agregarlo aquí después de comprobarlo en el código de la librería.
// Un archivo .d.ts no genera código: solo describe la forma de lo que ya existe.

declare module "foliate-js/view.js" {
  // El paginador (<foliate-paginator>) que dibuja el libro. setStyles: CSS que se inyecta en cada capítulo.
  export interface Paginador extends HTMLElement {
    setStyles(css: string): void;
    next(): Promise<void>;
  }

  // <foliate-view>: importar el módulo registra el elemento (customElements.define).
  // Eventos: "relocate" (detail: { fraction 0–1, tocItem }), "load" (detail: { doc } del capítulo cargado) y
  // "external-link" (cancelable; si nadie lo cancela, la librería abre el enlace con window.open).
  export class View extends HTMLElement {
    open(libro: File): Promise<void>;
    close(): void;
    goLeft(): Promise<void>;
    goRight(): Promise<void>;
    renderer: Paginador;
  }
}
