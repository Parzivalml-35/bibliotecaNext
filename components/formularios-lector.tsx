"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { registrarLector, verificarCorreo } from "@/lib/actions/cuenta";
import { reservarObra } from "@/lib/actions/reservas";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// Formularios del lado del lector. Client Components solo por useActionState (mensaje y "pendiente").

// D-02, RN-70. Los atributos required/minLength/type son comodidad: la acción valida todo de nuevo.
export function FormularioRegistro() {
  const [estado, accion, pendiente] = useActionState(registrarLector, estadoInicial);
  const v = estado.valores ?? {};
  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className={claseEtiqueta}>Nombre</label>
          <input id="nombre" name="nombre" required maxLength={60} autoComplete="given-name" defaultValue={v.nombre} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="apellido" className={claseEtiqueta}>Apellido</label>
          <input id="apellido" name="apellido" required maxLength={60} autoComplete="family-name" defaultValue={v.apellido} className={claseCampo} />
        </div>
      </div>
      <div>
        <label htmlFor="fecha_nacimiento" className={claseEtiqueta}>Fecha de nacimiento</label>
        <input id="fecha_nacimiento" name="fecha_nacimiento" type="date" required autoComplete="bday"
               defaultValue={v.fecha_nacimiento} className={claseCampo} aria-describedby="ayuda-nacimiento" />
        <p id="ayuda-nacimiento" className="mt-1 text-xs text-zinc-500">Algunos libros tienen clasificación por edad.</p>
      </div>
      <div>
        <label htmlFor="correo" className={claseEtiqueta}>Correo</label>
        <input id="correo" name="correo" type="email" required autoComplete="email" defaultValue={v.correo} className={claseCampo} />
      </div>
      <div>
        <label htmlFor="contrasena" className={claseEtiqueta}>Contraseña</label>
        {/* new-password: el gestor de contraseñas ofrece generar una */}
        <input id="contrasena" name="contrasena" type="password" required minLength={12} autoComplete="new-password"
               className={claseCampo} aria-describedby="ayuda-contrasena" />
        <p id="ayuda-contrasena" className="mt-1 text-xs text-zinc-500">Mínimo 12 caracteres. Una frase larga es más segura que una palabra con símbolos.</p>
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={`${claseBoton} w-full`}>
        {pendiente ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}

// RN-32: el token llega en la URL, pero solo se consume con este POST.
export function FormularioVerificar({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState(verificarCorreo, estadoInicial);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <MensajeFormulario estado={estado} />
      {!estado.exito && (
        <button type="submit" disabled={pendiente} className={claseBoton}>
          {pendiente ? "Verificando…" : "Confirmar mi correo"}
        </button>
      )}
    </form>
  );
}

// RN-07, RN-08: el lector elige la sede viendo la disponibilidad de cada una.
export function FormularioReserva({ isbn, sedes }: { isbn: string; sedes: { id_sede: number; sede: string; disponibles: number }[] }) {
  const [estado, accion, pendiente] = useActionState(reservarObra, estadoInicial);
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="isbn" value={isbn} />
      <div>
        <label htmlFor="id_sede" className={claseEtiqueta}>¿Dónde quieres recogerlo?</label>
        <select id="id_sede" name="id_sede" className={claseCampo} defaultValue={sedes.find((s) => s.disponibles > 0)?.id_sede ?? sedes[0]?.id_sede}>
          {sedes.map((s) => (
            <option key={s.id_sede} value={s.id_sede}>
              {s.sede} — {s.disponibles > 0 ? `${s.disponibles} disponible${s.disponibles === 1 ? "" : "s"}` : "sin copias libres (entras a la cola)"}
            </option>
          ))}
        </select>
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>
        {pendiente ? "Reservando…" : "Reservar"}
      </button>
    </form>
  );
}
