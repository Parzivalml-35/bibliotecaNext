"use client";

import { IconoLampara } from "@/components/marca/iconos";
import { Button } from "@/components/ui/button";
import { aplicarPreferencia, preferenciaActual } from "@/lib/tema";
import { cn } from "@/lib/utils";

// DI-03: la lámpara de pared, arriba a la derecha. Enciende o apaga la luz cálida; apagada vuelve a la base que
// recuerda data-tema-base. Mismo truco que BotonTema: los dos estados se dibujan y el CSS muestra el activo.
// `flotante`: fuera de la barra, con el mismo aspecto que el botón flotante de tema (borde, fondo de tarjeta, 44 px).
// `className`: dónde y cuándo se muestra (lo decide quien lo usa).
export function BotonLampara({ flotante = false, className }: { flotante?: boolean; className?: string }) {
  function cambiar() {
    const actual = preferenciaActual();
    aplicarPreferencia({ ...actual, lampara: !actual.lampara });
  }

  return (
    <Button type="button" variant={flotante ? "outline" : "ghost"} size={flotante ? "icon-lg" : "icon"} onClick={cambiar}
            className={cn(flotante && "size-11 bg-card", className)}>
      {/* Apagada: cualquier tema que no sea lámpara. */}
      <span className="flex items-center justify-center in-data-[tema=lampara]:hidden">
        <IconoLampara />
        <span className="sr-only">Encender la luz cálida</span>
      </span>
      <span className="hidden items-center justify-center in-data-[tema=lampara]:flex">
        <IconoLampara encendida />
        <span className="sr-only">Apagar la luz cálida</span>
      </span>
    </Button>
  );
}
