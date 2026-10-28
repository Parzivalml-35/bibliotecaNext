"use client";

import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// DI-02: las pestañas de la barra superior. QUÉ pestañas hay lo decide el servidor con la sesión
// (NavegacionPrincipal); aquí solo se marca la activa con la ruta, que un layout no conoce (igual que NavegacionPanel).
// `tambien`: otras rutas que cuentan como esta pestaña (la ficha de un libro es parte del catálogo).
export type Pestana = { titulo: string; ruta: string; tambien?: string[] };

// "/" solo coincide consigo misma: ruta.startsWith("//") nunca es cierto.
function estaActiva(ruta: string, p: Pestana): boolean {
  return [p.ruta, ...(p.tambien ?? [])].some((r) => ruta === r || ruta.startsWith(`${r}/`));
}

// Escritorio: pastillas en línea. `hidden md:flex` las oculta por debajo de 768 px, donde aparece MenuMovil.
export function PestanasPrincipales({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Principal" className="hidden md:block">
      <ul className="flex gap-1">
        {pestanas.map((p) => (
          <li key={p.ruta}>
            <Link
              href={p.ruta}
              aria-current={estaActiva(ruta, p) ? "page" : undefined}
              className={cn(
                "block rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                estaActiva(ruta, p)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p.titulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Celular: las mismas pestañas dentro de un panel lateral (Sheet de shadcn, que por dentro es el Dialog de Radix:
// atrapa el foco, se cierra con Escape y bloquea el desplazamiento de la página de atrás).
export function MenuMovil({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="md:hidden">
          <HugeiconsIcon icon={Menu01Icon} aria-hidden="true" />
          <span className="sr-only">Abrir menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          {/* Radix exige un título en todo diálogo: es lo que anuncia el lector de pantalla al abrirlo. */}
          <SheetTitle>Biblioteca Next</SheetTitle>
        </SheetHeader>
        <nav aria-label="Principal" className="px-4">
          <ul className="space-y-1">
            {pestanas.map((p) => (
              <li key={p.ruta}>
                {/* SheetClose asChild: el enlace también cierra el panel. Sin esto, al navegar el panel
                    seguiría abierto, porque el layout (y este componente) no se vuelven a montar. */}
                <SheetClose asChild>
                  <Link
                    href={p.ruta}
                    aria-current={estaActiva(ruta, p) ? "page" : undefined}
                    className={cn(
                      "block rounded-full px-4 py-2 font-medium transition-colors",
                      estaActiva(ruta, p)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {p.titulo}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
