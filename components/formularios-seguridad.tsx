"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { confirmarCambioCorreo, solicitarCambioCorreo } from "@/lib/actions/cuenta";
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

// RN-79, paso 1. El correo nuevo vuelve tras un error (estado.valores) para no tener que escribirlo otra vez.
// Tras pedir el cambio, el formulario muestra el aviso y no se oculta: se puede pedir otro enlace (reemplaza al anterior).
export function FormularioCorreo() {
  const [estado, accion, pendiente] = useActionState(solicitarCambioCorreo, estadoInicial);
  return (
    <form action={accion} className="space-y-4">
      <div>
        <label htmlFor="correo_nuevo" className={claseEtiqueta}>Correo nuevo</label>
        {/* autoComplete="email" y no "username": es un dato que se escribe, no la cuenta con la que se entra hoy. */}
        <input id="correo_nuevo" name="correo_nuevo" type="email" required maxLength={254} autoComplete="email"
               defaultValue={estado.valores?.correo_nuevo} className={claseCampo} />
      </div>
      <div>
        {/* id distinto del formulario de contraseña: los dos viven en la misma página y un id se repite una sola vez. */}
        <label htmlFor="contrasena_actual_correo" className={claseEtiqueta}>Contraseña actual</label>
        <input id="contrasena_actual_correo" name="contrasena_actual" type="password" required autoComplete="current-password"
               className={claseCampo} />
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>
        {pendiente ? "Enviando…" : "Enviar enlace de confirmación"}
      </button>
    </form>
  );
}

// RN-79, paso 2, como FormularioVerificar (RN-32): el token llega en la URL, pero solo se usa con este POST.
export function FormularioConfirmarCorreo({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState(confirmarCambioCorreo, estadoInicial);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <MensajeFormulario estado={estado} />
      {!estado.exito && (
        <button type="submit" disabled={pendiente} className={claseBoton}>
          {pendiente ? "Confirmando…" : "Confirmar el nuevo correo"}
        </button>
      )}
    </form>
  );
}
