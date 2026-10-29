import type { ReactNode } from "react";

// "Estados comunes" de docs/diseno.md: una lista sin elementos se muestra como un bloque con borde punteado, una
// frase que explica y, si hay, la acción siguiente ("Aún no tienes préstamos. Busca un libro"). Server Component.
export function EstadoVacio({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mt-2 rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {accion && <div className="mt-3 flex justify-center">{accion}</div>}
    </div>
  );
}
