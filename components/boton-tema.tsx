"use client";

import { Moon02Icon, Sun03Icon, TableLampIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { COOKIE_TEMA, DURACION_COOKIE_TEMA, resolverTema, TEMAS, type Tema } from "@/lib/tema";

// DI-03: botón de tres estados. Muestra el tema actual y al hacer clic pasa al siguiente (claro → oscuro → lámpara).
// Se dibujan los tres íconos y el CSS deja visible solo el del data-tema activo: el servidor no sabe qué tema
// eligió el navegador, y así el HTML del servidor y el del cliente son idénticos (no hay error de hidratación).
const opciones: Record<Tema, { icono: typeof Sun03Icon; nombre: string; visible: string }> = {
  claro: { icono: Sun03Icon, nombre: "claro", visible: "in-data-[tema=claro]:flex" },
  oscuro: { icono: Moon02Icon, nombre: "oscuro", visible: "in-data-[tema=oscuro]:flex" },
  lampara: { icono: TableLampIcon, nombre: "lámpara", visible: "in-data-[tema=lampara]:flex" },
};

function siguiente(tema: Tema): Tema {
  return TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
}

export function BotonTema() {
  // En next dev, el modo Strict de React vuelve a montar <html> y borra el data-tema que puso el script del
  // <head> (guía "Preventing flash before hydration"). Esto lo vuelve a poner antes de pintar.
  // En producción no hace nada nuevo: el atributo ya está con el mismo valor.
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    if (!raiz.dataset.tema) {
      raiz.dataset.tema = resolverTema(document.cookie, matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  function cambiar() {
    const raiz = document.documentElement;
    const actual = TEMAS.find((t) => t === raiz.dataset.tema) ?? "claro";
    const nuevo = siguiente(actual);
    // dataset.tema es el atributo data-tema: cambiarlo cambia las variables de globals.css al instante.
    raiz.dataset.tema = nuevo;
    document.cookie = `${COOKIE_TEMA}=${nuevo}; path=/; max-age=${DURACION_COOKIE_TEMA}; SameSite=Lax`;
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={cambiar}>
      {TEMAS.map((tema) => (
        <span key={tema} className={`hidden items-center justify-center ${opciones[tema].visible}`}>
          <HugeiconsIcon icon={opciones[tema].icono} aria-hidden="true" />
          <span className="sr-only">
            Tema {opciones[tema].nombre}. Cambiar a {opciones[siguiente(tema)].nombre}
          </span>
        </span>
      ))}
    </Button>
  );
}
