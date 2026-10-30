"use client";

import { IconoLampara } from "@/components/marca/iconos";
import { Button } from "@/components/ui/button";
import { aplicarPreferencia, preferenciaActual } from "@/lib/tema";

// DI-03: la lámpara de pared, arriba a la derecha. Enciende o apaga la luz cálida; apagada vuelve a la base que
// recuerda data-tema-base. Mismo truco que BotonTema: los dos estados se dibujan y el CSS muestra el activo.
export function BotonLampara() {
  function cambiar() {
    const actual = preferenciaActual();
    aplicarPreferencia({ ...actual, lampara: !actual.lampara });
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={cambiar}>
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
