"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { iniciarSesion } from "@/lib/actions/sesion";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// Client Component solo por useActionState: el hook guarda lo que devolvió la última ejecución de la
// acción (el error, el correo escrito) y `pendiente` mientras corre. El formulario funciona igual sin JS:
// el navegador hace un POST normal y Next responde con la página ya renderizada con ese estado.
// `siguiente` (RN-83) viaja en un campo oculto: así funciona también sin JavaScript, como POST normal.
export function FormularioLogin({ siguiente }: { siguiente: string | null }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, estadoInicial);

  return (
    <form action={accion} className="space-y-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      <div>
        <label htmlFor="correo" className={claseEtiqueta}>Correo</label>
        {/* defaultValue (no value): el campo sigue siendo no controlado. React 19 reinicia el formulario
            al terminar la acción; al reiniciarse toma este valor, así el correo no se borra si hubo error. */}
        <input id="correo" name="correo" type="email" autoComplete="username" required
               defaultValue={estado.valores?.correo} className={claseCampo} />
      </div>
      <div>
        <label htmlFor="contrasena" className={claseEtiqueta}>Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required
               className={claseCampo} />
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={`${claseBoton} w-full`}>
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
