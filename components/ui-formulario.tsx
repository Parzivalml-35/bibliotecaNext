import { buttonVariants } from "@/components/ui/button";
import type { EstadoFormulario } from "@/lib/definitions";
import { cn } from "@/lib/utils";

// Piezas compartidas por los formularios de la Fase 3 (login, préstamo, devolución).
// Sin "use client": sirven tanto en Server como en Client Components.
// R4b: los mismos nombres de antes, ahora con los tokens del tema (DI-08, DI-09). Los formularios no cambian.

export const claseEtiqueta = "block text-sm font-medium text-foreground";

// La forma del Input del preset Maia (píldora, borde `input`, anillo `ring` con el foco), escrita como clase para
// que sirva igual en <input> y en <select>.
export const claseCampo =
  "mt-1 h-10 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

// El botón principal de shadcn (buttonVariants) en tamaño grande. Mientras la acción corre (pending), se ve inactivo.
export const claseBoton = cn(buttonVariants({ size: "lg" }), "disabled:cursor-wait");

// Mensaje de resultado. role="alert" hace que el lector de pantalla lo anuncie apenas aparece (el error
// llega sin recargar la página); role="status" es la versión cortés, para confirmaciones.
export function MensajeFormulario({ estado }: { estado: EstadoFormulario }) {
  if (estado.error) {
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger-suave px-3 py-2 text-sm text-danger-texto">
        {estado.error}
      </p>
    );
  }
  if (estado.exito) {
    return (
      <p role="status" className="rounded-xl border border-success/40 bg-success-suave px-3 py-2 text-sm text-success-texto">
        {estado.exito}
      </p>
    );
  }
  return null;
}
