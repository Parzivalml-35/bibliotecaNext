"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { devolverEjemplar } from "@/lib/actions/circulacion";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// Basta el código de barras: el préstamo abierto se encuentra a partir del ejemplar.
export function FormularioDevolucion() {
  const [estado, accion, pendiente] = useActionState(devolverEjemplar, estadoInicial);

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label htmlFor="codigo" className={claseEtiqueta}>Código de barras del ejemplar</label>
        <input id="codigo" name="codigo" required autoComplete="off" placeholder="BN-0001"
               defaultValue={estado.valores?.codigo} className={`${claseCampo} font-mono uppercase`} />
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>
        {pendiente ? "Registrando…" : "Registrar devolución"}
      </button>
    </form>
  );
}
