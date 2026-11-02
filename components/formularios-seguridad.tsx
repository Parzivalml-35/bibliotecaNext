"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { cambiarContrasena } from "@/lib/actions/sesion";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// Formularios de la seguridad de la CUENTA (RN-78, RN-79): sirven igual a un lector (/cuenta/seguridad) y a un
// empleado (/panel/perfil, R7i). Client Components solo por useActionState.

// RN-78. `correo` va en un campo oculto con autoComplete="username": así el gestor de contraseñas sabe de QUÉ cuenta
// es la contraseña nueva y actualiza la entrada correcta en vez de crear una sin usuario.
export function FormularioContrasena({ correo }: { correo: string }) {
  const [estado, accion, pendiente] = useActionState(cambiarContrasena, estadoInicial);
  return (
    <form action={accion} className="space-y-4">
      <input type="text" name="usuario" autoComplete="username" value={correo} readOnly hidden />
      <div>
        <label htmlFor="contrasena_actual" className={claseEtiqueta}>Contraseña actual</label>
        <input id="contrasena_actual" name="contrasena_actual" type="password" required autoComplete="current-password"
               className={claseCampo} />
      </div>
      <div>
        <label htmlFor="contrasena_nueva" className={claseEtiqueta}>Contraseña nueva</label>
        <input id="contrasena_nueva" name="contrasena_nueva" type="password" required minLength={12} maxLength={256}
               autoComplete="new-password" className={claseCampo} aria-describedby="ayuda-contrasena-nueva" />
        <p id="ayuda-contrasena-nueva" className="mt-1 text-xs text-muted-foreground">
          Mínimo 12 caracteres y distinta de la actual. Al cambiarla, se cierra tu sesión en los demás dispositivos; en este
          sigues dentro.
        </p>
      </div>
      <div>
        <label htmlFor="contrasena_confirmacion" className={claseEtiqueta}>Repite la contraseña nueva</label>
        {/* new-password también aquí: el gestor rellena los dos campos con la que generó. */}
        <input id="contrasena_confirmacion" name="contrasena_confirmacion" type="password" required minLength={12} maxLength={256}
               autoComplete="new-password" className={claseCampo} />
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>
        {pendiente ? "Cambiando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
