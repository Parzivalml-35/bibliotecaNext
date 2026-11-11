"use client";

import { useEffect, useState } from "react";
import { claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { guardarTema } from "@/lib/actions/tema";
import type { EstadoFormulario } from "@/lib/definitions";
import { aplicarPreferencia, type Preferencia, preferenciaActual, type TemaBase } from "@/lib/tema";

// Las tres bases, con "Seguir al sistema" (base null) primero: es lo que tiene quien nunca eligió.
const OPCIONES: { valor: TemaBase | null; nombre: string; ayuda: string }[] = [
  { valor: null, nombre: "Seguir al sistema", ayuda: "Claro u oscuro según tu equipo" },
  { valor: "claro", nombre: "Claro", ayuda: "Siempre claro" },
  { valor: "oscuro", nombre: "Oscuro", ayuda: "Siempre oscuro" },
];

// Las mismas tarjetas con radio de FormularioAvatar (has-checked: pinta la que está elegida).
const claseOpcion =
  "group flex cursor-pointer flex-col gap-0.5 rounded-2xl border border-border p-3 text-sm transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50";

// DI-04 (R7h): el tema en "Mi cuenta". A diferencia del resto de formularios, no hay botón de enviar: cada cambio se
// aplica al instante (como los botones de sol, luna y lámpara) y se guarda en la cuenta. El tema depende de
// JavaScript de todas formas (lo pone el script del <head>), así que aquí no hay versión sin JS que conservar.
// `inicial`: la preferencia de las cookies de este equipo, leída por el servidor, para que el HTML ya venga marcado.
export function FormularioTema({ inicial }: { inicial: Preferencia }) {
  const [preferencia, setPreferencia] = useState(inicial);
  const [estado, setEstado] = useState<EstadoFormulario>({});

  // El botón flotante y la lámpara de la barra también cambian el tema mientras esta página está abierta. Un
  // MutationObserver avisa cuando cambian los atributos de <html>, y el formulario vuelve a leer las cookies: así
  // los radios nunca muestran una preferencia vieja. La función que devuelve el efecto lo desconecta al salir.
  useEffect(() => {
    const observador = new MutationObserver(() => setPreferencia(preferenciaActual()));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-tema-base"] });
    return () => observador.disconnect();
  }, []);

  async function cambiar(nueva: Preferencia) {
    aplicarPreferencia(nueva); // se ve al instante; el observador actualiza el estado
    setEstado({});
    const guardado = await guardarTema(nueva);
    setEstado(guardado
      ? { exito: "Guardado en tu cuenta: lo verás también al entrar desde otro equipo." }
      : { error: "Se aplicó en este equipo, pero no se pudo guardar en tu cuenta. Inténtalo de nuevo." });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={claseEtiqueta}>Base</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {OPCIONES.map((o) => (
            <label key={o.nombre} className={claseOpcion}>
              {/* sr-only: el círculo no se ve, pero sigue para el teclado (flechas) y el lector de pantalla.
                  value "" para null: el valor de un radio siempre es texto. */}
              <input type="radio" name="base" value={o.valor ?? ""} checked={preferencia.base === o.valor}
                     onChange={() => cambiar({ base: o.valor, lampara: false })} className="sr-only" />
              <span className="font-medium">{o.nombre}</span>
              <span className="text-muted-foreground group-has-checked:text-accent-foreground/80">{o.ayuda}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Elegir una base apaga la luz cálida, igual que el botón de sol y luna.</p>
      </fieldset>

      {/* Casilla nativa: accent-primary (CSS accent-color) la pinta con el color principal del tema activo. */}
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={preferencia.lampara}
               onChange={(e) => cambiar({ ...preferencia, lampara: e.target.checked })}
               className="size-4 accent-primary" />
        <span>
          <span className="font-medium">Luz cálida</span>
          <span className="text-muted-foreground"> — la lámpara de pared: reemplaza a la base mientras está encendida.</span>
        </span>
      </label>

      <MensajeFormulario estado={estado} />
    </div>
  );
}
