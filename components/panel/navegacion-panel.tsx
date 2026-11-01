"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SeccionPanel } from "@/lib/permisos";
import { cn } from "@/lib/utils";

// DI-10: pestañas con las secciones del rol y, debajo, las páginas de la sección activa (si tiene más de una).
// Client Component solo por usePathname: un layout no se vuelve a renderizar al navegar, así que no conoce la ruta
// actual; un Client Component sí (guía de layout.md, "Pathname"). QUÉ secciones se muestran lo decidió el
// servidor (MenuPanel); aquí solo se marca cuál está activa.
export function NavegacionPanel({ secciones }: { secciones: SeccionPanel[] }) {
  const ruta = usePathname();
  // "/panel/mostrador/prestamo" está dentro de "/panel/mostrador"; el "/" evita que "/panel/red" coincida
  // con una futura "/panel/redes".
  const activa = secciones.find((s) => ruta === s.ruta || ruta.startsWith(`${s.ruta}/`));

  return (
    <nav aria-label="Panel de empleado" className="mb-8 space-y-3 border-b border-border pb-3">
      {/* overflow-x-auto: en el celular las pestañas se desplazan en horizontal en vez de partirse en líneas. */}
      <ul className="flex gap-1 overflow-x-auto">
        {secciones.map((s) => (
          <li key={s.ruta}>
            <Link
              href={s.paginas[0].ruta}
              aria-current={s === activa ? "true" : undefined}
              className={cn(
                "block rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                s === activa
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.titulo}
            </Link>
          </li>
        ))}
      </ul>

      {activa && activa.paginas.length > 1 && (
        <ul className="flex gap-4 overflow-x-auto px-1">
          {activa.paginas.map((p) => (
            <li key={p.ruta}>
              <Link
                href={p.ruta}
                // aria-current="page": el lector de pantalla anuncia "página actual"; también sirve para estilos.
                aria-current={ruta === p.ruta ? "page" : undefined}
                className={cn(
                  "block border-b-2 pb-1 text-sm whitespace-nowrap transition-colors",
                  ruta === p.ruta
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {p.titulo}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
