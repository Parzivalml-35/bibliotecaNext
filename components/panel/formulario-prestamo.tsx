"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { prestarEjemplar } from "@/lib/actions/circulacion";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// En mostrador: el lector muestra su documento (D-03) y el empleado lee el código de barras del ejemplar.
// Tras un préstamo exitoso, React reinicia el formulario y queda vacío para el siguiente; si hubo error,
// los campos conservan lo escrito (vuelven en estado.valores).
export function FormularioPrestamo() {
  const [estado, accion, pendiente] = useActionState(prestarEjemplar, estadoInicial);
  const v = estado.valores ?? {};

  return (
    <form action={accion} className="space-y-4">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Lector</legend>
        <div>
          <label htmlFor="tipo_documento" className={claseEtiqueta}>Tipo de documento</label>
          <select id="tipo_documento" name="tipo_documento" defaultValue={v.tipo_documento ?? "CC"} className={claseCampo}>
            <option value="CC">Cédula (CC)</option>
            <option value="TI">Tarjeta de identidad (TI)</option>
            <option value="CE">Cédula de extranjería (CE)</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="numero_documento" className={claseEtiqueta}>Número de documento</label>
          <input id="numero_documento" name="numero_documento" required inputMode="numeric" autoComplete="off"
                 defaultValue={v.numero_documento} className={claseCampo} />
        </div>
      </fieldset>
      <div>
        <label htmlFor="codigo" className={claseEtiqueta}>Código de barras del ejemplar</label>
        <input id="codigo" name="codigo" required autoComplete="off" placeholder="BN-0002"
               defaultValue={v.codigo} className={`${claseCampo} font-mono uppercase`} />
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>
        {pendiente ? "Registrando…" : "Registrar préstamo"}
      </button>
    </form>
  );
}
