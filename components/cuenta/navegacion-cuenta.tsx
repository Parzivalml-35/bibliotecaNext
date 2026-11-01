"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// DI-10 (resuelve UX-04): las pestañas de "Mi cuenta". Son las mismas para todo lector, así que no dependen de la
// sesión ni del rol: una lista fija. Perfil y Seguridad se agregan en R7, cuando existan sus páginas.
const PESTANAS = [
  { titulo: "Resumen", ruta: "/cuenta" },
  { titulo: "Préstamos y reservas", ruta: "/cuenta/prestamos" },
  { titulo: "Digitales", ruta: "/cuenta/digitales" },
  { titulo: "Multas", ruta: "/cuenta/multas" },
];

// Client Component solo por usePathname, como NavegacionPanel: el layout no se vuelve a renderizar al navegar y no
// conoce la ruta actual (guía de layout.md, "Pathname").
export function NavegacionCuenta() {
  const ruta = usePathname();

  return (
    <nav aria-label="Mi cuenta" className="mb-8 border-b border-border pb-3">
      {/* overflow-x-auto: en el celular las pestañas se desplazan en horizontal en vez de partirse en líneas. */}
      <ul className="flex gap-1 overflow-x-auto">
        {PESTANAS.map((p) => {
          // Comparación exacta, no por prefijo: "/cuenta" es el inicio de todas las rutas de la zona. Por eso en la
          // pasarela (/cuenta/pago/…) ninguna pestaña queda activa.
          const activa = ruta === p.ruta;
          return (
            <li key={p.ruta}>
              <Link
                href={p.ruta}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "block rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  activa
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
