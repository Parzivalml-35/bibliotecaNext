import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

// DI-13 y "Logo e íconos de marca" (docs/diseno.md): TODO el arte de marca vive aquí. Botones, barra y estilos solo
// piden "el sol" o "el logo"; cuando lleguen los diseños definitivos se reemplaza el contenido de estas funciones y
// nada más cambia. Server Components (sin estado): sirven dentro de Client Components también.
// Todos son decorativos (aria-hidden): el nombre accesible lo pone el botón o el enlace que los contiene.

type PropsIcono = { className?: string };

// Provisionales: los de Hugeicons, la misma familia del resto de la interfaz (grilla 24, trazo 1.5).
export function IconoSol({ className }: PropsIcono) {
  return <HugeiconsIcon icon={Sun03Icon} aria-hidden="true" className={className} />;
}

export function IconoLuna({ className }: PropsIcono) {
  return <HugeiconsIcon icon={Moon02Icon} aria-hidden="true" className={className} />;
}

// Provisional propio: un aplique de pared (base redonda, brazo, varilla y pantalla cónica), como la referencia del
// usuario. Hugeicons solo trae lámparas colgantes o de mesa. Encendida, unos rayos con el token `decorativo`.
export function IconoLampara({ className, encendida = false }: PropsIcono & { encendida?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" className={cn("size-6", className)}>
      <circle cx="6" cy="15" r="2.5" />
      <path d="M8.5 15H14" />
      <path d="M14 10.5V21" />
      <path d="M11.5 4h5l1.5 6.5h-8z" />
      {encendida && (
        <g stroke="var(--decorativo)">
          <path d="M14 1.5V2.5M19.5 3L18.8 3.7M8.5 3L9.2 3.7M21 9H20M7 9H8" />
        </g>
      )}
    </svg>
  );
}

// Emblema provisional (DI-13): un marcapáginas de proporción 4:5 con un libro abierto. Usa los tokens del tema, así
// funciona en los tres. El definitivo debe respetar la misma caja (viewBox 40 × 50) para no mover la barra.
export function Logo({ className }: PropsIcono) {
  return (
    <svg viewBox="0 0 40 50" aria-hidden="true" className={cn("h-auto", className)}>
      <path d="M4 2h32a2 2 0 0 1 2 2v44l-18-9-18 9V4a2 2 0 0 1 2-2z" fill="var(--primary)" />
      <g fill="none" stroke="var(--primary-foreground)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
        <path d="M20 15c-3-2-7-2.5-10-2v14c3-.5 7 0 10 2 3-2 7-2.5 10-2V13c-3-.5-7 0-10 2z" />
        <path d="M20 15v14" />
      </g>
    </svg>
  );
}
