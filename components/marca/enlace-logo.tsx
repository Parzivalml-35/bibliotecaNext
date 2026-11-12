import Link from "next/link";
import { Logo } from "@/components/marca/iconos";
import { cn } from "@/lib/utils";

// DI-13: el emblema como enlace al catálogo, en tamaño compacto, para las barras del visor (/leer), que están fuera de
// la barra del sitio (app/(sitio)/layout.tsx, donde el emblema cuelga de la cápsula y lleva su propio enlace).
// Pedido del usuario (2026-11-12): el logo se ve en TODAS las vistas, también leyendo.
// Sin "use client": un Link y un SVG no necesitan JavaScript propio; lo pueden usar Server y Client Components.
// <Link> y no <a>: SALIR del visor no necesita la CSP de RN-84 (eso importa al ENTRAR a /leer).
// w-7 (28 px de ancho → 35 px de alto en 4:5): cabe en una fila de 44 px (h-11) sin estirarla.
export function EnlaceLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex shrink-0 rounded-md p-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none", className)}>
      <Logo className="w-7" />
      {/* El SVG es aria-hidden: el nombre del enlace es este texto, que solo oye el lector de pantalla. */}
      <span className="sr-only">Biblioteca Next, ir al catálogo</span>
    </Link>
  );
}
