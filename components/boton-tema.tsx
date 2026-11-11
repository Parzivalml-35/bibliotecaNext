"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { IconoLuna, IconoSol } from "@/components/marca/iconos";
import { buttonVariants } from "@/components/ui/button";
import { guardarTema } from "@/lib/actions/tema";
import { aplicarPreferencia, baseVisible, pintarPreferencia, preferenciaActual } from "@/lib/tema";
import { cn } from "@/lib/utils";

// DI-03: botón flotante abajo a la derecha que alterna la base, claro ↔ oscuro. Elegir la base apaga la lámpara
// (DI-04). Se dibujan los dos íconos y sus textos, y el CSS deja visible solo el de la base activa
// (in-data-[tema-base=…]): el servidor no sabe qué tema eligió el navegador, y así el HTML del servidor y el del
// cliente son idénticos (no hay error de hidratación). Va una sola vez en app/layout.tsx: aparece en todas las
// páginas, también en el visor.
export function BotonTema() {
  // Pinta los atributos según las cookies al montar y en CADA cambio de ruta, antes de pintar (useLayoutEffect):
  // - En next dev, el modo Strict de React vuelve a montar <html> y borra los atributos que puso el script del <head>
  //   (guía "Preventing flash before hydration").
  // - R7h: el login escribe las cookies del tema de la cuenta en el servidor y termina en redirect(), que con
  //   JavaScript es una navegación del cliente: no se descarga un documento nuevo y el script del <head> no vuelve a
  //   correr. Este componente está en el layout raíz (no se desmonta al navegar) y usePathname avisa del cambio.
  // Solo pinta: nunca escribe cookies (sin cookie de base, sigue al sistema sin fijarlo). Si nada cambió, no toca nada.
  const ruta = usePathname();
  useLayoutEffect(() => {
    pintarPreferencia(preferenciaActual());
  }, [ruta]);

  function cambiar() {
    // La base que se VE (si sigue al sistema, la del sistema): el clic cambia lo que la persona está viendo.
    const preferencia = { base: baseVisible() === "claro" ? "oscuro" : "claro", lampara: false } as const;
    aplicarPreferencia(preferencia);
    // DI-04 (R7h): con sesión, también en la cuenta. Sin await: el cambio ya se ve y no depende del servidor.
    void guardarTema(preferencia);
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      // fixed: queda en la esquina aunque se desplace la página. z-40: por encima del contenido y de la barra,
      // por debajo de los menús de Radix (z-50). size-11: 44 px, la zona táctil mínima recomendada.
      className={cn(buttonVariants({ variant: "outline", size: "icon-lg" }), "fixed right-4 bottom-4 z-40 size-11 bg-card")}
    >
      <span className="hidden items-center justify-center in-data-[tema-base=claro]:flex">
        <IconoSol />
        <span className="sr-only">Tema claro. Cambiar a oscuro</span>
      </span>
      <span className="hidden items-center justify-center in-data-[tema-base=oscuro]:flex">
        <IconoLuna />
        <span className="sr-only">Tema oscuro. Cambiar a claro</span>
      </span>
    </button>
  );
}
