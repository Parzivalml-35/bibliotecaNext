"use client";

import Image from "next/image";
import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { claseBoton, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { elegirEstiloAvatar, generarOtroAvatar } from "@/lib/actions/avatar";
import type { EstadoFormulario } from "@/lib/definitions";
import { cn } from "@/lib/utils";

const estadoInicial: EstadoFormulario = {};

// Una opción del selector, ya resuelta en el servidor: lib/avatar.ts usa node:crypto y no puede venir al navegador.
export type OpcionAvatar = { estilo: string; nombre: string; url: string };

type Props = { actual: OpcionAvatar; opciones: OpcionAvatar[] };

// RN-81: avatar generado de la CUENTA (sirve a un lector y, en R7i, a un empleado). Dos formularios con su propia
// acción: "Generar otro" (semilla nueva) y "Usar este estilo" (misma semilla). Client Component solo por useActionState.
// Funciona sin JavaScript: las imágenes son <img> normales y el selector son radios de HTML.
export function FormularioAvatar({ actual, opciones }: Props) {
  const [estadoSemilla, accionSemilla, generando] = useActionState(generarOtroAvatar, estadoInicial);
  const [estadoEstilo, accionEstilo, guardando] = useActionState(elegirEstiloAvatar, estadoInicial);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* next/image con unoptimized: un SVG no se optimiza (la guía lo recomienda así) y sale como un <img> que el
            navegador pide a /avatar/…, cacheado para siempre. width/height reservan el espacio: la página no salta. */}
        <Image src={actual.url} alt="Tu avatar actual" width={96} height={96} unoptimized
               className="size-24 rounded-full border border-border bg-muted" />
        <form action={accionSemilla}>
          <button type="submit" disabled={generando} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "disabled:cursor-wait")}>
            {generando ? "Generando…" : "Generar otro"}
          </button>
        </form>
      </div>
      <MensajeFormulario estado={estadoSemilla} />

      <form action={accionEstilo} className="space-y-4">
        {/* fieldset + legend: el lector de pantalla anuncia "Estilo" al entrar al grupo de radios. */}
        <fieldset>
          <legend className={claseEtiqueta}>Estilo</legend>
          <p className="mt-1 text-sm text-muted-foreground">Cada opción muestra cómo quedaría tu avatar con ese estilo.</p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {opciones.map((o) => (
              // La tarjeta entera es la <label>: un clic en cualquier parte marca su radio. has-checked: y
              // has-focus-visible: (Tailwind 4, CSS :has()) pintan la tarjeta según el estado del radio que contiene.
              <label key={o.estilo}
                     className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center text-sm transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                {/* sr-only: el círculo del radio no se ve, pero sigue ahí para el teclado (flechas) y el lector de pantalla. */}
                <input type="radio" name="estilo" value={o.estilo} defaultChecked={o.estilo === actual.estilo} required className="sr-only" />
                {/* alt="": el nombre del estilo ya es el texto de la opción; describir el dibujo no aporta. */}
                <Image src={o.url} alt="" width={64} height={64} unoptimized className="size-16 rounded-full bg-muted" />
                {o.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <MensajeFormulario estado={estadoEstilo} />
        <button type="submit" disabled={guardando} className={claseBoton}>
          {guardando ? "Guardando…" : "Usar este estilo"}
        </button>
      </form>
    </div>
  );
}
