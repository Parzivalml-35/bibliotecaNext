"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COLOR_ANOTACION,
  COLORES_ANOTACION,
  type ColorAnotacion,
  ESTILOS_ANOTACION,
  type EstiloAnotacion,
  esColorAnotacion,
  esEstiloAnotacion,
  NOMBRE_ESTILO_ANOTACION,
} from "@/lib/lectura";

// El lápiz de arriba a la derecha (decidido con el usuario el 2026-11-11): qué pasa al seleccionar texto y con qué
// color y estilo se marca en los modos instantáneos. Se abre con clic, Enter o un toque (no al pasar el mouse: eso no
// existe en el celular ni con el teclado). DropdownMenu de Radix: el foco entra al menú, las flechas recorren las
// opciones y Esc lo cierra. Las opciones del panel de notas se agregan con el panel derecho (R10-D).

export const MODOS_SELECCION = ["menu", "instantaneo", "anotar"] as const;
export type ModoSeleccion = (typeof MODOS_SELECCION)[number];
const NOMBRE_MODO: Record<ModoSeleccion, string> = {
  menu: "Mostrar menú",
  instantaneo: "Resaltar al instante",
  anotar: "Resaltar y anotar",
};

export function Lapiz({ modo, color, estilo, alCambiarModo, alCambiarColor, alCambiarEstilo }: {
  modo: ModoSeleccion;
  color: ColorAnotacion;
  estilo: EstiloAnotacion;
  alCambiarModo: (m: ModoSeleccion) => void;
  alCambiarColor: (c: ColorAnotacion) => void;
  alCambiarEstilo: (e: EstiloAnotacion) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon">
          <HugeiconsIcon icon={PencilEdit02Icon} aria-hidden="true" />
          <span className="sr-only">Opciones para marcar el texto</span>
        </Button>
      </DropdownMenuTrigger>
      {/* align="end": el borde derecho del menú coincide con el del lápiz (no se sale de la pantalla). */}
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Al seleccionar texto</DropdownMenuLabel>
        {/* RadioGroup de Radix: elegir una opción la marca (✓) y llama a onValueChange con su value (texto). */}
        <DropdownMenuRadioGroup value={modo}
                                onValueChange={(v) => (MODOS_SELECCION as readonly string[]).includes(v) && alCambiarModo(v as ModoSeleccion)}>
          {MODOS_SELECCION.map((m) => (
            <DropdownMenuRadioItem key={m} value={m}>{NOMBRE_MODO[m]}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Color al instante</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={color} onValueChange={(v) => esColorAnotacion(v) && alCambiarColor(v)}>
          {COLORES_ANOTACION.map((c) => (
            <DropdownMenuRadioItem key={c} value={c}>
              <span aria-hidden="true" className="size-4 rounded-full" style={{ backgroundColor: COLOR_ANOTACION[c].fondo }} />
              {COLOR_ANOTACION[c].nombre}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Estilo al instante</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={estilo} onValueChange={(v) => esEstiloAnotacion(v) && alCambiarEstilo(v)}>
          {ESTILOS_ANOTACION.map((e) => (
            <DropdownMenuRadioItem key={e} value={e}>{NOMBRE_ESTILO_ANOTACION[e]}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
