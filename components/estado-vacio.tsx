import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// "Estados comunes" de docs/diseno.md: una lista sin elementos se muestra como un bloque con borde punteado, una
// frase que explica y, si hay, la acción siguiente ("Aún no tienes préstamos. Busca un libro"). Server Component.
// `className`: para ajustar el margen según la página (cn() deja que gane el de quien lo usa).
export function EstadoVacio({ children, accion, className }: { children: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground", className)}>
      <p>{children}</p>
      {accion && <div className="mt-3 flex justify-center">{accion}</div>}
    </div>
  );
}
