import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// DI-13 y "Logo e íconos de marca" (docs/diseno.md): TODO el arte de marca vive aquí. Botones, barra y estilos solo
// piden "el sol" o "el logo"; si el arte cambia, se reemplaza el contenido de estas funciones y nada más cambia.
// Server Components (sin estado): sirven dentro de Client Components también.
// Todos son decorativos (aria-hidden): el nombre accesible lo pone el botón o el enlace que los contiene.
//
// Los originales están en docs/marca/*.svg (hechos en Claude Design). Aquí van como JSX y no como <img src="…svg">:
// - incrustados, ven las variables CSS de la página (var(--primary) cambia con el tema);
// - el CSS puede animar sus partes: cada pieza animable es un <g data-parte="…"> (globals.css, "Marca en movimiento").
// Diferencias con el archivo: atributos en camelCase (stroke-width → strokeWidth), sin xmlns y con className.
// Sin id ni degradados: el emblema aparece varias veces en una página y los id repetidos chocan entre copias.

type PropsIcono = { className?: string };

// Íconos: grilla de 24, trazo de 1.5, currentColor (toman el color del texto del botón), como Hugeicons.
// size-6 (24 px) por defecto, el mismo tamaño que tenían los de Hugeicons.
function Icono({ className, children }: PropsIcono & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" className={cn("size-6", className)}>
      {children}
    </svg>
  );
}

// Sol: núcleo y ocho rayos. Los rayos giran 45° al pasar el mouse (.icono-animado).
export function IconoSol({ className }: PropsIcono) {
  return (
    <Icono className={className}>
      <g data-parte="nucleo">
        <circle cx="12" cy="12" r="4" />
      </g>
      <g data-parte="rayos">
        <path d="M12 5.5L12 3M16.5 7.5L18 6M18.5 12L21 12M16.5 16.5L18 18M12 18.5L12 21M7.5 16.5L6 18M5.5 12L3 12M7.5 7.5L6 6" />
      </g>
    </Icono>
  );
}

// Luna: creciente. Se balancea al pasar el mouse (.icono-animado).
export function IconoLuna({ className }: PropsIcono) {
  return (
    <Icono className={className}>
      <g data-parte="luna">
        <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5A10 10 0 0 0 20.5 14.5Z" />
      </g>
    </Icono>
  );
}

// Aplique de pared (placa a la derecha, brazo curvo y pantalla a la izquierda), como la luz de la pared del sitio.
// Encendida suma tres rayos hacia abajo con el token `decorativo`, que "calientan" al aparecer (.icono-animado).
export function IconoLampara({ className, encendida = false }: PropsIcono & { encendida?: boolean }) {
  return (
    <Icono className={className}>
      <g data-parte="aplique">
        <rect x="17.5" y="6" width="3.5" height="11" rx="1.75" />
        <path d="M17.5 11.5C14 11.5 13.5 3.5 8.5 3.5V6.5" />
        <path d="M7 6.5H10L13.5 14H3.5Z" />
      </g>
      {encendida && (
        <g data-parte="rayos" stroke="var(--decorativo)">
          <path d="M8.5 17V20.5M5 16.5L3.5 19M12 16.5L13.5 19" />
        </g>
      )}
    </Icono>
  );
}

// Emblema (DI-13): la lechuza de frente con las alas abiertas hechas de páginas y un libro abierto en el pecho.
// Caja 40 × 50 (4:5) con 4 unidades de margen; toma primary y primary-foreground, así funciona en los tres temas.
// Dos versiones con las MISMAS partes (las animaciones sirven para las dos):
// - Logo: plana, para tamaños chicos (desde 40 px de alto): el visor.
// - LogoPrincipal: con volumen (capas de luz y sombra con fillOpacity), desde ~56 px: la barra del sitio.
// Son dos funciones y no una con una prop: así quien solo usa la plana (un Client Component, como el visor) no
// arrastra la principal al JavaScript del navegador.
export function Logo({ className }: PropsIcono) {
  return (
    <svg viewBox="0 0 40 50" aria-hidden="true" className={cn("h-auto", className)}>
      <g data-parte="ala-izq">
        <path d="M15.1 25.9 L14.5 24.6 L13.9 23.5 L13.1 22.7 L12.4 22 L11.5 21.7 L10.6 21.5 L9.7 21.5 L8.7 21.6 Q7.7 24.9 7.2 27.8 L7.2 27.8 L8.3 27.2 L9.3 26.7 L10.4 26.3 L11.4 26.1 L12.3 26.1 L13.2 26.4 L14 26.7 L14.9 27.1Z" fill="var(--primary)" />
        <path d="M15.3 26 L14.9 24.5 L14.4 23.2 L13.9 22.1 L13.2 21.2 L12.3 20.5 L11.4 20 L10.3 19.7 L9.2 19.5 Q7.3 22.2 6 25 L6 25 L7.4 24.8 L8.7 24.6 L9.9 24.6 L11.1 24.8 L12.1 25.2 L13 25.7 L13.8 26.4 L14.7 27Z" fill="var(--primary)" />
        <path d="M12.3 25.3 L11.7 25 L10.9 24.8 L10.2 24.6 L9.3 24.6 L8.5 24.7 L7.5 24.8" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.4 26.1 L15.3 24.3 L15 22.7 L14.5 21.3 L13.8 20 L13 18.9 L12 17.9 L10.9 17.1 L9.7 16.4 Q7 18.4 5.1 20.8 L5.1 20.8 L6.7 21.2 L8.2 21.6 L9.6 22.2 L10.8 22.9 L11.9 23.8 L12.9 24.8 L13.7 25.8 L14.6 26.9Z" fill="var(--primary)" />
        <path d="M12.2 24 L11.5 23.4 L10.7 22.8 L9.8 22.3 L8.9 21.9 L7.9 21.6 L6.8 21.3" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 26.2 L15.5 23.8 L15.3 21.5 L14.9 19.4 L14.3 17.3 L13.4 15.3 L12.4 13.5 L11.2 11.7 L9.9 10 Q6.6 11.1 4.2 13 L4.2 13 L6 14.5 L7.7 16 L9.2 17.6 L10.6 19.3 L11.7 21 L12.7 22.9 L13.6 24.9 L14.5 26.8Z" fill="var(--primary)" />
        <path d="M12 21.6 L11.3 20.3 L10.5 19.1 L9.5 17.9 L8.5 16.8 L7.4 15.7 L6.2 14.7" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.6 26.4 L16.1 23.5 L16.4 20.6 L16.5 17.8 L16.3 15 L15.9 12.3 L15.3 9.7 L14.5 7 L13.6 4.4 Q10.1 4.4 7.3 5.8 L7.3 5.8 L8.7 8.3 L10.1 10.8 L11.3 13.3 L12.2 15.9 L13 18.5 L13.5 21.2 L14 23.9 L14.4 26.6Z" fill="var(--primary)" />
        <path d="M13.2 19.3 L12.7 17.4 L12.2 15.6 L11.5 13.8 L10.7 12.1 L9.8 10.3 L8.9 8.6" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g data-parte="ala-der">
        <path d="M24.9 25.9 L25.5 24.6 L26.1 23.5 L26.9 22.7 L27.6 22 L28.5 21.7 L29.4 21.5 L30.3 21.5 L31.3 21.6 Q32.3 24.9 32.8 27.8 L32.8 27.8 L31.7 27.2 L30.7 26.7 L29.6 26.3 L28.6 26.1 L27.7 26.1 L26.8 26.4 L26 26.7 L25.1 27.1Z" fill="var(--primary)" />
        <path d="M24.7 26 L25.1 24.5 L25.6 23.2 L26.1 22.1 L26.8 21.2 L27.7 20.5 L28.6 20 L29.7 19.7 L30.8 19.5 Q32.7 22.2 34 25 L34 25 L32.6 24.8 L31.3 24.6 L30.1 24.6 L28.9 24.8 L27.9 25.2 L27 25.7 L26.2 26.4 L25.3 27Z" fill="var(--primary)" />
        <path d="M27.7 25.3 L28.3 25 L29.1 24.8 L29.8 24.6 L30.7 24.6 L31.5 24.7 L32.5 24.8" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.6 26.1 L24.7 24.3 L25 22.7 L25.5 21.3 L26.2 20 L27 18.9 L28 17.9 L29.1 17.1 L30.3 16.4 Q33 18.4 34.9 20.8 L34.9 20.8 L33.3 21.2 L31.8 21.6 L30.4 22.2 L29.2 22.9 L28.1 23.8 L27.1 24.8 L26.3 25.8 L25.4 26.9Z" fill="var(--primary)" />
        <path d="M27.8 24 L28.5 23.4 L29.3 22.8 L30.2 22.3 L31.1 21.9 L32.1 21.6 L33.2 21.3" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.5 26.2 L24.5 23.8 L24.7 21.5 L25.1 19.4 L25.7 17.3 L26.6 15.3 L27.6 13.5 L28.8 11.7 L30.1 10 Q33.4 11.1 35.8 13 L35.8 13 L34 14.5 L32.3 16 L30.8 17.6 L29.4 19.3 L28.3 21 L27.3 22.9 L26.4 24.9 L25.5 26.8Z" fill="var(--primary)" />
        <path d="M28 21.6 L28.7 20.3 L29.5 19.1 L30.5 17.9 L31.5 16.8 L32.6 15.7 L33.8 14.7" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.4 26.4 L23.9 23.5 L23.6 20.6 L23.5 17.8 L23.7 15 L24.1 12.3 L24.7 9.7 L25.5 7 L26.4 4.4 Q29.9 4.4 32.7 5.8 L32.7 5.8 L31.3 8.3 L29.9 10.8 L28.7 13.3 L27.8 15.9 L27 18.5 L26.5 21.2 L26 23.9 L25.6 26.6Z" fill="var(--primary)" />
        <path d="M26.8 19.3 L27.3 17.4 L27.8 15.6 L28.5 13.8 L29.3 12.1 L30.2 10.3 L31.1 8.6" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g data-parte="cola">
        <path d="M17 37 L14.6 44 Q15.2 45.6 16.6 45.6 L20 46 L23.4 45.6 Q24.8 45.6 25.4 44 L23 37Z" fill="var(--primary)" />
        <path d="M18.6 40 L17.8 43.6 M21.4 40 L22.2 43.6" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.3" strokeLinecap="round" />
      </g>
      <g data-parte="libro">
        <path d="M20 21 C25.5 21 27 27 26.6 32 C26.3 36 23.6 39 20 39 C16.4 39 13.7 36 13.4 32 C13 27 14.5 21 20 21Z" fill="var(--primary)" />
        <path d="M10.8 27.4 C14 26 17 26.2 19.3 27.6 V38.6 C17 37.4 14 37.2 10.8 38.2Z" fill="var(--primary)" />
        <path d="M29.2 27.4 C26 26 23 26.2 20.7 27.6 V38.6 C23 37.4 26 37.2 29.2 38.2Z" fill="var(--primary)" />
        <path d="M11.8 28.7 C14.6 27.5 17.2 27.6 19.3 28.8 M28.2 28.7 C25.4 27.5 22.8 27.6 20.7 28.8" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M12.6 26.8 C15 26.1 17.4 26.4 19.3 27.6 M27.4 26.8 C25 26.1 22.6 26.4 20.7 27.6 M20 27.4 V38" fill="none" stroke="var(--primary-foreground)" strokeWidth="1.3" strokeLinecap="round" />
      </g>
      <g data-parte="cabeza">
        <path d="M11.6 16 C11.6 13 12.7 10.8 13.9 9.8 L13 5 L17.4 8.3 C19.1 7.8 20.9 7.8 22.6 8.3 L27 5 L26.1 9.8 C27.3 10.8 28.4 13 28.4 16 C28.4 21.4 24.6 24.6 20 24.6 C15.4 24.6 11.6 21.4 11.6 16Z" fill="var(--primary)" />
      </g>
      <g data-parte="ojos">
        <circle cx="16.4" cy="15.6" r="2.9" fill="var(--primary-foreground)" />
        <circle cx="23.6" cy="15.6" r="2.9" fill="var(--primary-foreground)" />
        <circle cx="16.6" cy="16" r="1.25" fill="var(--primary)" />
        <circle cx="23.4" cy="16" r="1.25" fill="var(--primary)" />
      </g>
      <g data-parte="pico">
        <path d="M18.9 19.3 H21.1 L20 21.7Z" fill="var(--primary-foreground)" />
      </g>
    </svg>
  );
}

export function LogoPrincipal({ className }: PropsIcono) {
  return (
    <svg viewBox="0 0 40 50" aria-hidden="true" className={cn("h-auto", className)}>
      <g data-parte="ala-izq">
        <path d="M15.1 25.9 L14.5 24.6 L13.9 23.5 L13.1 22.7 L12.4 22 L11.5 21.7 L10.6 21.5 L9.7 21.5 L8.7 21.6 Q7.7 24.9 7.2 27.8 L7.2 27.8 L8.3 27.2 L9.3 26.7 L10.4 26.3 L11.4 26.1 L12.3 26.1 L13.2 26.4 L14 26.7 L14.9 27.1Z" fill="var(--primary)" />
        <path d="M15.1 25.9 L14.5 24.6 L13.9 23.5 L13.1 22.7 L12.4 22 L11.5 21.7 L10.6 21.5 L9.7 21.5 L8.7 21.6 Q7.7 24.9 7.2 27.8 L7.2 27.8 L8.3 27.2 L9.3 26.7 L10.4 26.3 L11.4 26.1 L12.3 26.1 L13.2 26.4 L14 26.7 L14.9 27.1Z" fill="white" fillOpacity="0.12" />
        <path d="M9.8 22 L8.7 21.6 L7.7 24.9 L7.2 27.8 L8.7 26.6Z" fill="white" fillOpacity="0.2" />
        <path d="M15.3 26 L14.9 24.5 L14.4 23.2 L13.9 22.1 L13.2 21.2 L12.3 20.5 L11.4 20 L10.3 19.7 L9.2 19.5 Q7.3 22.2 6 25 L6 25 L7.4 24.8 L8.7 24.6 L9.9 24.6 L11.1 24.8 L12.1 25.2 L13 25.7 L13.8 26.4 L14.7 27Z" fill="var(--primary)" />
        <path d="M15.3 26 L14.9 24.5 L14.4 23.2 L13.9 22.1 L13.2 21.2 L12.3 20.5 L11.4 20 L10.3 19.7 L9.2 19.5 Q7.3 22.2 6 25 L6 25 L7.4 24.8 L8.7 24.6 L9.9 24.6 L11.1 24.8 L12.1 25.2 L13 25.7 L13.8 26.4 L14.7 27Z" fill="black" fillOpacity="0.1" />
        <path d="M10.4 20.2 L9.2 19.5 L7.3 22.2 L6 25 L8 24.3Z" fill="white" fillOpacity="0.2" />
        <path d="M14.7 27 L14 26.5 L13.3 25.9 L12.6 25.4 L11.8 25 L10.9 24.8 L10 24.6 L10 24.6 L10.6 25.2 L11.3 25.9 L12 26.4 L12.8 26.8 L13.7 27 L14.7 27Z" fill="black" fillOpacity="0.22" />
        <path d="M12.3 25.3 L11.7 25 L10.9 24.8 L10.2 24.6 L9.3 24.6 L8.5 24.7 L7.5 24.8" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.4 26.1 L15.3 24.3 L15 22.7 L14.5 21.3 L13.8 20 L13 18.9 L12 17.9 L10.9 17.1 L9.7 16.4 Q7 18.4 5.1 20.8 L5.1 20.8 L6.7 21.2 L8.2 21.6 L9.6 22.2 L10.8 22.9 L11.9 23.8 L12.9 24.8 L13.7 25.8 L14.6 26.9Z" fill="var(--primary)" />
        <path d="M15.4 26.1 L15.3 24.3 L15 22.7 L14.5 21.3 L13.8 20 L13 18.9 L12 17.9 L10.9 17.1 L9.7 16.4 Q7 18.4 5.1 20.8 L5.1 20.8 L6.7 21.2 L8.2 21.6 L9.6 22.2 L10.8 22.9 L11.9 23.8 L12.9 24.8 L13.7 25.8 L14.6 26.9Z" fill="white" fillOpacity="0.12" />
        <path d="M10.8 17.7 L9.7 16.4 L7 18.4 L5.1 20.8 L7.4 21Z" fill="white" fillOpacity="0.2" />
        <path d="M14.6 26.9 L13.8 26 L13.2 25.1 L12.4 24.3 L11.6 23.5 L10.7 22.8 L9.6 22.2 L9.6 22.2 L10.3 23.2 L10.9 24.1 L11.6 25 L12.5 25.8 L13.4 26.4 L14.6 26.9Z" fill="black" fillOpacity="0.22" />
        <path d="M12.2 24 L11.5 23.4 L10.7 22.8 L9.8 22.3 L8.9 21.9 L7.9 21.6 L6.8 21.3" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 26.2 L15.5 23.8 L15.3 21.5 L14.9 19.4 L14.3 17.3 L13.4 15.3 L12.4 13.5 L11.2 11.7 L9.9 10 Q6.6 11.1 4.2 13 L4.2 13 L6 14.5 L7.7 16 L9.2 17.6 L10.6 19.3 L11.7 21 L12.7 22.9 L13.6 24.9 L14.5 26.8Z" fill="var(--primary)" />
        <path d="M15.5 26.2 L15.5 23.8 L15.3 21.5 L14.9 19.4 L14.3 17.3 L13.4 15.3 L12.4 13.5 L11.2 11.7 L9.9 10 Q6.6 11.1 4.2 13 L4.2 13 L6 14.5 L7.7 16 L9.2 17.6 L10.6 19.3 L11.7 21 L12.7 22.9 L13.6 24.9 L14.5 26.8Z" fill="black" fillOpacity="0.1" />
        <path d="M11.1 12.5 L9.9 10 L6.6 11.1 L4.2 13 L6.9 14.7Z" fill="white" fillOpacity="0.2" />
        <path d="M14.5 26.8 L13.7 25.2 L13 23.6 L12.3 22 L11.4 20.5 L10.4 19 L9.3 17.6 L9.3 17.6 L9.9 19.3 L10.6 20.9 L11.3 22.5 L12.2 24 L13.2 25.5 L14.5 26.8Z" fill="black" fillOpacity="0.22" />
        <path d="M12 21.6 L11.3 20.3 L10.5 19.1 L9.5 17.9 L8.5 16.8 L7.4 15.7 L6.2 14.7" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.6 26.4 L16.1 23.5 L16.4 20.6 L16.5 17.8 L16.3 15 L15.9 12.3 L15.3 9.7 L14.5 7 L13.6 4.4 Q10.1 4.4 7.3 5.8 L7.3 5.8 L8.7 8.3 L10.1 10.8 L11.3 13.3 L12.2 15.9 L13 18.5 L13.5 21.2 L14 23.9 L14.4 26.6Z" fill="var(--primary)" />
        <path d="M15.6 26.4 L16.1 23.5 L16.4 20.6 L16.5 17.8 L16.3 15 L15.9 12.3 L15.3 9.7 L14.5 7 L13.6 4.4 Q10.1 4.4 7.3 5.8 L7.3 5.8 L8.7 8.3 L10.1 10.8 L11.3 13.3 L12.2 15.9 L13 18.5 L13.5 21.2 L14 23.9 L14.4 26.6Z" fill="white" fillOpacity="0.12" />
        <path d="M14.2 7.9 L13.6 4.4 L10.1 4.4 L7.3 5.8 L9.6 8.9Z" fill="white" fillOpacity="0.2" />
        <path d="M14.4 26.6 L14 24.4 L13.7 22.2 L13.3 19.9 L12.8 17.7 L12.1 15.6 L11.3 13.4 L11.3 13.4 L11.6 15.7 L11.9 17.9 L12.2 20.2 L12.8 22.4 L13.5 24.5 L14.4 26.6Z" fill="black" fillOpacity="0.22" />
        <path d="M13.2 19.3 L12.7 17.4 L12.2 15.6 L11.5 13.8 L10.7 12.1 L9.8 10.3 L8.9 8.6" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g data-parte="ala-der">
        <path d="M24.9 25.9 L25.5 24.6 L26.1 23.5 L26.9 22.7 L27.6 22 L28.5 21.7 L29.4 21.5 L30.3 21.5 L31.3 21.6 Q32.3 24.9 32.8 27.8 L32.8 27.8 L31.7 27.2 L30.7 26.7 L29.6 26.3 L28.6 26.1 L27.7 26.1 L26.8 26.4 L26 26.7 L25.1 27.1Z" fill="var(--primary)" />
        <path d="M24.9 25.9 L25.5 24.6 L26.1 23.5 L26.9 22.7 L27.6 22 L28.5 21.7 L29.4 21.5 L30.3 21.5 L31.3 21.6 Q32.3 24.9 32.8 27.8 L32.8 27.8 L31.7 27.2 L30.7 26.7 L29.6 26.3 L28.6 26.1 L27.7 26.1 L26.8 26.4 L26 26.7 L25.1 27.1Z" fill="white" fillOpacity="0.12" />
        <path d="M30.2 22 L31.3 21.6 L32.3 24.9 L32.8 27.8 L31.3 26.6Z" fill="white" fillOpacity="0.2" />
        <path d="M24.7 26 L25.1 24.5 L25.6 23.2 L26.1 22.1 L26.8 21.2 L27.7 20.5 L28.6 20 L29.7 19.7 L30.8 19.5 Q32.7 22.2 34 25 L34 25 L32.6 24.8 L31.3 24.6 L30.1 24.6 L28.9 24.8 L27.9 25.2 L27 25.7 L26.2 26.4 L25.3 27Z" fill="var(--primary)" />
        <path d="M24.7 26 L25.1 24.5 L25.6 23.2 L26.1 22.1 L26.8 21.2 L27.7 20.5 L28.6 20 L29.7 19.7 L30.8 19.5 Q32.7 22.2 34 25 L34 25 L32.6 24.8 L31.3 24.6 L30.1 24.6 L28.9 24.8 L27.9 25.2 L27 25.7 L26.2 26.4 L25.3 27Z" fill="black" fillOpacity="0.1" />
        <path d="M29.6 20.2 L30.8 19.5 L32.7 22.2 L34 25 L32 24.3Z" fill="white" fillOpacity="0.2" />
        <path d="M25.3 27 L26 26.5 L26.7 25.9 L27.4 25.4 L28.2 25 L29.1 24.8 L30 24.6 L30 24.6 L29.4 25.2 L28.7 25.9 L28 26.4 L27.2 26.8 L26.3 27 L25.3 27Z" fill="black" fillOpacity="0.22" />
        <path d="M27.7 25.3 L28.3 25 L29.1 24.8 L29.8 24.6 L30.7 24.6 L31.5 24.7 L32.5 24.8" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.6 26.1 L24.7 24.3 L25 22.7 L25.5 21.3 L26.2 20 L27 18.9 L28 17.9 L29.1 17.1 L30.3 16.4 Q33 18.4 34.9 20.8 L34.9 20.8 L33.3 21.2 L31.8 21.6 L30.4 22.2 L29.2 22.9 L28.1 23.8 L27.1 24.8 L26.3 25.8 L25.4 26.9Z" fill="var(--primary)" />
        <path d="M24.6 26.1 L24.7 24.3 L25 22.7 L25.5 21.3 L26.2 20 L27 18.9 L28 17.9 L29.1 17.1 L30.3 16.4 Q33 18.4 34.9 20.8 L34.9 20.8 L33.3 21.2 L31.8 21.6 L30.4 22.2 L29.2 22.9 L28.1 23.8 L27.1 24.8 L26.3 25.8 L25.4 26.9Z" fill="white" fillOpacity="0.12" />
        <path d="M29.2 17.7 L30.3 16.4 L33 18.4 L34.9 20.8 L32.6 21Z" fill="white" fillOpacity="0.2" />
        <path d="M25.4 26.9 L26.2 26 L26.8 25.1 L27.6 24.3 L28.4 23.5 L29.3 22.8 L30.4 22.2 L30.4 22.2 L29.7 23.2 L29.1 24.1 L28.4 25 L27.5 25.8 L26.6 26.4 L25.4 26.9Z" fill="black" fillOpacity="0.22" />
        <path d="M27.8 24 L28.5 23.4 L29.3 22.8 L30.2 22.3 L31.1 21.9 L32.1 21.6 L33.2 21.3" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.5 26.2 L24.5 23.8 L24.7 21.5 L25.1 19.4 L25.7 17.3 L26.6 15.3 L27.6 13.5 L28.8 11.7 L30.1 10 Q33.4 11.1 35.8 13 L35.8 13 L34 14.5 L32.3 16 L30.8 17.6 L29.4 19.3 L28.3 21 L27.3 22.9 L26.4 24.9 L25.5 26.8Z" fill="var(--primary)" />
        <path d="M24.5 26.2 L24.5 23.8 L24.7 21.5 L25.1 19.4 L25.7 17.3 L26.6 15.3 L27.6 13.5 L28.8 11.7 L30.1 10 Q33.4 11.1 35.8 13 L35.8 13 L34 14.5 L32.3 16 L30.8 17.6 L29.4 19.3 L28.3 21 L27.3 22.9 L26.4 24.9 L25.5 26.8Z" fill="black" fillOpacity="0.1" />
        <path d="M28.9 12.5 L30.1 10 L33.4 11.1 L35.8 13 L33.1 14.7Z" fill="white" fillOpacity="0.2" />
        <path d="M25.5 26.8 L26.3 25.2 L27 23.6 L27.7 22 L28.6 20.5 L29.6 19 L30.7 17.6 L30.7 17.6 L30.1 19.3 L29.4 20.9 L28.7 22.5 L27.8 24 L26.8 25.5 L25.5 26.8Z" fill="black" fillOpacity="0.22" />
        <path d="M28 21.6 L28.7 20.3 L29.5 19.1 L30.5 17.9 L31.5 16.8 L32.6 15.7 L33.8 14.7" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24.4 26.4 L23.9 23.5 L23.6 20.6 L23.5 17.8 L23.7 15 L24.1 12.3 L24.7 9.7 L25.5 7 L26.4 4.4 Q29.9 4.4 32.7 5.8 L32.7 5.8 L31.3 8.3 L29.9 10.8 L28.7 13.3 L27.8 15.9 L27 18.5 L26.5 21.2 L26 23.9 L25.6 26.6Z" fill="var(--primary)" />
        <path d="M24.4 26.4 L23.9 23.5 L23.6 20.6 L23.5 17.8 L23.7 15 L24.1 12.3 L24.7 9.7 L25.5 7 L26.4 4.4 Q29.9 4.4 32.7 5.8 L32.7 5.8 L31.3 8.3 L29.9 10.8 L28.7 13.3 L27.8 15.9 L27 18.5 L26.5 21.2 L26 23.9 L25.6 26.6Z" fill="white" fillOpacity="0.12" />
        <path d="M25.8 7.9 L26.4 4.4 L29.9 4.4 L32.7 5.8 L30.4 8.9Z" fill="white" fillOpacity="0.2" />
        <path d="M25.6 26.6 L26 24.4 L26.3 22.2 L26.7 19.9 L27.2 17.7 L27.9 15.6 L28.7 13.4 L28.7 13.4 L28.4 15.7 L28.1 17.9 L27.8 20.2 L27.2 22.4 L26.5 24.5 L25.6 26.6Z" fill="black" fillOpacity="0.22" />
        <path d="M26.8 19.3 L27.3 17.4 L27.8 15.6 L28.5 13.8 L29.3 12.1 L30.2 10.3 L31.1 8.6" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g data-parte="cola">
        <path d="M17 37 L14.6 44 Q15.2 45.6 16.6 45.6 L20 46 L23.4 45.6 Q24.8 45.6 25.4 44 L23 37Z" fill="var(--primary)" />
        <path d="M18.2 38 L17.6 45.8 L20 46 L20 38Z" fill="black" fillOpacity="0.16" />
        <path d="M18.6 40 L17.8 43.6 M21.4 40 L22.2 43.6" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g data-parte="libro">
        <path d="M20 21 C25.5 21 27 27 26.6 32 C26.3 36 23.6 39 20 39 C16.4 39 13.7 36 13.4 32 C13 27 14.5 21 20 21Z" fill="var(--primary)" />
        <path d="M20 21 C25.5 21 27 27 26.6 32 C26.3 36 23.6 39 20 39 C22 35 22.6 27 20 21Z" fill="black" fillOpacity="0.12" />
        <path d="M10.8 27.4 C14 26 17 26.2 19.3 27.6 V38.6 C17 37.4 14 37.2 10.8 38.2Z" fill="var(--primary)" />
        <path d="M29.2 27.4 C26 26 23 26.2 20.7 27.6 V38.6 C23 37.4 26 37.2 29.2 38.2Z" fill="var(--primary)" />
        <path d="M10.8 27.4 C14 26 17 26.2 19.3 27.6 V38.6 C17 37.4 14 37.2 10.8 38.2Z" fill="white" fillOpacity="0.16" />
        <path d="M29.2 27.4 C26 26 23 26.2 20.7 27.6 V38.6 C23 37.4 26 37.2 29.2 38.2Z" fill="black" fillOpacity="0.14" />
        <path d="M12.6 26.9 C15.4 25.8 17.8 26 19.3 27 V29 C17.6 28 15 27.8 12.6 28.6Z" fill="white" fillOpacity="0.22" />
        <path d="M11.8 28.7 C14.6 27.5 17.2 27.6 19.3 28.8 M28.2 28.7 C25.4 27.5 22.8 27.6 20.7 28.8" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M12.6 26.8 C15 26.1 17.4 26.4 19.3 27.6 M27.4 26.8 C25 26.1 22.6 26.4 20.7 27.6 M20 27.4 V38" fill="none" stroke="var(--primary-foreground)" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g data-parte="cabeza">
        <path d="M11.6 16 C11.6 13 12.7 10.8 13.9 9.8 L13 5 L17.4 8.3 C19.1 7.8 20.9 7.8 22.6 8.3 L27 5 L26.1 9.8 C27.3 10.8 28.4 13 28.4 16 C28.4 21.4 24.6 24.6 20 24.6 C15.4 24.6 11.6 21.4 11.6 16Z" fill="var(--primary)" />
        <path d="M14 21.4 C16 23.6 18 24.6 20 24.6 C24.6 24.6 28.4 21.4 28.4 16 C28.4 19.6 25 22.6 20 22.6 C17.4 22.6 15.4 22.2 14 21.4Z" fill="black" fillOpacity="0.2" />
        <path d="M14.6 12 C16.4 10.2 18.2 9.6 20 9.6 C21.8 9.6 23.6 10.2 25.4 12 C23.6 11.2 21.8 10.9 20 10.9 C18.2 10.9 16.4 11.2 14.6 12Z" fill="white" fillOpacity="0.28" />
      </g>
      <g data-parte="ojos">
        <circle cx="16.4" cy="15.6" r="2.9" fill="var(--primary-foreground)" />
        <circle cx="23.6" cy="15.6" r="2.9" fill="var(--primary-foreground)" />
        <circle cx="16.6" cy="16" r="1.25" fill="var(--primary)" />
        <circle cx="23.4" cy="16" r="1.25" fill="var(--primary)" />
        <circle cx="16.1" cy="15.4" r="0.45" fill="var(--primary-foreground)" />
        <circle cx="22.9" cy="15.4" r="0.45" fill="var(--primary-foreground)" />
      </g>
      <g data-parte="pico">
        <path d="M18.9 19.3 H21.1 L20 21.7Z" fill="var(--primary-foreground)" />
      </g>
    </svg>
  );
}
