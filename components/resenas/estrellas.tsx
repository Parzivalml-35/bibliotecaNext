import { cn } from "@/lib/utils";

// RN-94: las estrellas de una reseña o de un promedio, SOLO para mostrar (el formulario tiene las suyas, que se eligen).
// Sin "use client": sirve en Server y en Client Components. Un SVG propio (una estrella rellena): los íconos de Hugeicons
// son de trazo y no se pueden "llenar" a medias.

const CAMINO = "M12 2.6l2.85 5.95 6.55.85-4.8 4.5 1.25 6.5L12 17.2l-5.85 3.2 1.25-6.5-4.8-4.5 6.55-.85z";

export function IconoEstrella({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4", className)}>
      <path d={CAMINO} fill="currentColor" />
    </svg>
  );
}

// `valor` puede tener decimales (un promedio): la estrella a medias se dibuja recortando una llena encima de una vacía
// (overflow-hidden con el ancho en porcentaje). El texto sr-only dice el valor: el lector de pantalla no "ve" estrellas.
export function Estrellas({ valor, className }: { valor: number; className?: string }) {
  const texto = `${valor.toLocaleString("es-CO", { maximumFractionDigits: 1 })} de 5 estrellas`;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <span className="sr-only">{texto}</span>
      {[1, 2, 3, 4, 5].map((n) => {
        const lleno = Math.max(0, Math.min(1, valor - (n - 1))); // 0 a 1: cuánto de esta estrella va lleno
        return (
          <span key={n} aria-hidden="true" className="relative inline-block">
            {/* La vacía: el color apagado del tema. La llena: el acento (primary), con contraste medido en la Fase R. */}
            <IconoEstrella className="text-muted-foreground/35" />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${lleno * 100}%` }}>
              <IconoEstrella className="text-primary" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
