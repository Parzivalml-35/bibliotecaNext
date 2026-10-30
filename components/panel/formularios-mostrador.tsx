"use client";

import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { ubicarEjemplar } from "@/lib/actions/circulacion";
import { validarLector } from "@/lib/actions/cuenta";
import { anularMultaConMotivo } from "@/lib/actions/multas";
import type { EstadoFormulario } from "@/lib/definitions";
import { cn } from "@/lib/utils";

const estadoInicial: EstadoFormulario = {};

// Campo pequeño para los formularios en línea de una fila (anular, ubicar): la forma de claseCampo, al alto de un
// botón size="xs" (h-6 + borde) y sin ocupar todo el ancho.
const claseCampoPequeno =
  "h-7 rounded-4xl border border-input bg-input/30 px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
// Resultado de la acción: el mismo par de colores que BotonAccion.
const claseResultado = (estado: EstadoFormulario) => (estado.error ? "text-danger-texto" : "text-success-texto");

// Formularios del mostrador con más de un botón: validar lector, anular multa, ubicar ejemplar.

// D-03, RN-70: documento visto en persona + tipo de lector.
// RN-70: el documento viene del registro; el empleado lo corrige solo si no coincide con el original.
export function FormularioValidar({ idLector, tipos, documento }: {
  idLector: number;
  tipos: { id_tipo_lector: number; nombre: string }[];
  documento: { tipo: string; numero: string };
}) {
  const [estado, accion, pendiente] = useActionState(validarLector, estadoInicial);
  const v = estado.valores ?? {};
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id_lector" value={idLector} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tipo_documento" className={claseEtiqueta}>Documento</label>
          <select id="tipo_documento" name="tipo_documento" defaultValue={v.tipo_documento ?? documento.tipo} className={claseCampo}>
            <option value="CC">CC</option>
            <option value="TI">TI</option>
            <option value="CE">CE</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </div>
        <div>
          <label htmlFor="numero_documento" className={claseEtiqueta}>Número</label>
          <input id="numero_documento" name="numero_documento" required autoComplete="off" defaultValue={v.numero_documento ?? documento.numero} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="id_tipo_lector" className={claseEtiqueta}>Tipo de lector</label>
          <select id="id_tipo_lector" name="id_tipo_lector" className={claseCampo}>
            {tipos.map((t) => <option key={t.id_tipo_lector} value={t.id_tipo_lector}>{t.nombre}</option>)}
          </select>
        </div>
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>{pendiente ? "Validando…" : "Validar lector"}</button>
    </form>
  );
}

// RN-67: el motivo es obligatorio y queda guardado con quién anuló.
export function FormularioAnular({ idMulta }: { idMulta: number }) {
  const [estado, accion, pendiente] = useActionState(anularMultaConMotivo, estadoInicial);
  return (
    <form action={accion} className="flex flex-col gap-1">
      <input type="hidden" name="id_multa" value={idMulta} />
      <label htmlFor={`motivo-${idMulta}`} className="sr-only">Motivo de la anulación</label>
      <div className="flex gap-1">
        <input id={`motivo-${idMulta}`} name="motivo" required minLength={10} maxLength={255} placeholder="Motivo de la anulación"
               defaultValue={estado.valores?.motivo} className={cn(claseCampoPequeno, "w-48")} />
        <button type="submit" disabled={pendiente}
                className={buttonVariants({ variant: "destructive", size: "xs" })}>
          {pendiente ? "Anulando…" : "Anular"}
        </button>
      </div>
      <p aria-live="polite" className={cn("text-xs", claseResultado(estado))}>
        {estado.error ?? estado.exito}
      </p>
    </form>
  );
}

// RN-17, RN-20: el estante sale del catálogo de la sede; viene preseleccionado el sugerido.
export function FormularioUbicar({ codigo, sugerida, ubicaciones }: {
  codigo: string;
  sugerida: number | null;
  ubicaciones: { id_ubicacion: number; etiqueta: string; seccion: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(ubicarEjemplar, estadoInicial);
  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <input type="hidden" name="codigo" value={codigo} />
      <div className="flex gap-1">
        <label htmlFor={`estante-${codigo}`} className="sr-only">Estante para {codigo}</label>
        <select id={`estante-${codigo}`} name="id_ubicacion" defaultValue={sugerida ?? undefined}
                className={claseCampoPequeno}>
          {ubicaciones.map((u) => (
            <option key={u.id_ubicacion} value={u.id_ubicacion}>
              {u.etiqueta} · {u.seccion}{u.id_ubicacion === sugerida ? " (sugerido)" : ""}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pendiente}
                className={buttonVariants({ variant: "outline", size: "xs" })}>
          {pendiente ? "Ubicando…" : "Ubicar"}
        </button>
      </div>
      <p aria-live="polite" className={cn("max-w-72 text-right text-xs", claseResultado(estado))}>
        {estado.error ?? estado.exito}
      </p>
    </form>
  );
}
