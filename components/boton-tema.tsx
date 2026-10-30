"use client";

import { useLayoutEffect } from "react";
import { IconoLuna, IconoSol } from "@/components/marca/iconos";
import { buttonVariants } from "@/components/ui/button";
import { aplicarPreferencia, preferenciaActual, resolverPreferencia } from "@/lib/tema";
import { cn } from "@/lib/utils";

// DI-03: botón flotante abajo a la derecha que alterna la base, claro ↔ oscuro. Elegir la base apaga la lámpara
// (DI-04). Se dibujan los dos íconos y sus textos, y el CSS deja visible solo el de la base activa
// (in-data-[tema-base=…]): el servidor no sabe qué tema eligió el navegador, y así el HTML del servidor y el del
// cliente son idénticos (no hay error de hidratación). Va una sola vez en app/layout.tsx: aparece en todas las
// páginas, también en el visor.
export function BotonTema() {
  // En next dev, el modo Strict de React vuelve a montar <html> y borra los atributos que puso el script del
  // <head> (guía "Preventing flash before hydration"). Esto los vuelve a poner antes de pintar. En producción
  // no hace nada nuevo: los atributos ya están con el mismo valor.
  useLayoutEffect(() => {
    if (!document.documentElement.dataset.tema) {
      aplicarPreferencia(resolverPreferencia(document.cookie, matchMedia("(prefers-color-scheme: dark)").matches));
    }
  }, []);

  function cambiar() {
    const { base } = preferenciaActual();
    aplicarPreferencia({ base: base === "claro" ? "oscuro" : "claro", lampara: false });
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
