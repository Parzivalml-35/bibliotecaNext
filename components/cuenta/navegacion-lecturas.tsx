"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

type LibroDeLista = { isbn: string; titulo: string; autores: string | null; avance: number | null };

// La lista de "Mis lecturas" (R10-F, rediseño del 2026-11-12). Client Component solo por useSelectedLayoutSegment:
// el segmento activo UN nivel por debajo del layout de /cuenta/lecturas. En /cuenta/lecturas/9788418797453 es
// "9788418797453" (ese libro se marca); en /cuenta/lecturas es null (ninguno).
//
// En el celular no caben lista y detalle juntos: con un libro elegido, la lista se oculta (hidden lg:block) y el
// detalle ocupa la pantalla (trae "← Mis lecturas"). Sin libro elegido, la lista es lo que se ve.
export function NavegacionLecturas({ libros }: { libros: LibroDeLista[] }) {
  const elegido = useSelectedLayoutSegment();

  return (
    // lg:order-first: en el DOM la lista va DESPUÉS del contenido (en el celular se lee primero el título de la página);
    // en el escritorio la grilla la pone en la primera columna. lg:sticky lg:top-24: queda a la vista al desplazar un
    // detalle largo (top-24 = 6 rem, debajo de la barra flotante del sitio).
    <nav aria-label="Tus libros" className={cn("mt-4 lg:order-first lg:mt-0 lg:self-start lg:sticky lg:top-24", elegido ? "hidden lg:block" : "block")}>
      <ul className="space-y-1">
        {libros.map((l) => {
          const activo = l.isbn === elegido;
          return (
            <li key={l.isbn}>
              {/* <Link> (navegación del cliente): al elegir otro libro, el layout NO se vuelve a dibujar; solo cambia el
                  detalle. aria-current="page": el lector de pantalla anuncia cuál está abierto. */}
              <Link href={`/cuenta/lecturas/${l.isbn}`} aria-current={activo ? "page" : undefined}
                    className={cn("block rounded-xl border px-3 py-2.5 transition-colors",
                      activo ? "border-primary/40 bg-accent text-accent-foreground" : "border-transparent hover:bg-muted")}>
                <span className="line-clamp-2 font-heading text-sm font-semibold">{l.titulo}</span>
                {l.autores && <span className="block truncate text-xs text-muted-foreground">{l.autores}</span>}
                {l.avance !== null && (
                  // Barra fina decorativa (aria-hidden): el número va al lado, en texto.
                  <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    <span aria-hidden="true" className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${l.avance}%` }} />
                    </span>
                    {l.avance} %
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
