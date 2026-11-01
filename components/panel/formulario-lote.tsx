"use client";

import { useActionState } from "react";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { registrarLote } from "@/lib/actions/licencias";
import type { EstadoFormulario } from "@/lib/definitions";

const estadoInicial: EstadoFormulario = {};

// RN-54: un lote = cantidad de lecturas simultáneas de un título, con vencimiento opcional.
export function FormularioLote({ titulos, hoy }: { titulos: { isbn: string; titulo: string }[]; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(registrarLote, estadoInicial);
  const v = estado.valores ?? {};
  return (
    <form action={accion} className="space-y-3">
      <div>
        <label htmlFor="isbn" className={claseEtiqueta}>Título (con edición PDF)</label>
        <select id="isbn" name="isbn" required defaultValue={v.isbn ?? ""} className={claseCampo}>
          <option value="" disabled>Elige…</option>
          {titulos.map((t) => <option key={t.isbn} value={t.isbn}>{t.titulo}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="cantidad" className={claseEtiqueta}>Licencias</label>
          <input id="cantidad" name="cantidad" type="number" min={1} max={1000} required defaultValue={v.cantidad ?? "1"} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="fecha_adquisicion" className={claseEtiqueta}>Adquirido el</label>
          <input id="fecha_adquisicion" name="fecha_adquisicion" type="date" required max={hoy} defaultValue={v.fecha_adquisicion ?? hoy} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="fecha_vencimiento" className={claseEtiqueta}>Vence <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <input id="fecha_vencimiento" name="fecha_vencimiento" type="date" min={hoy} defaultValue={v.fecha_vencimiento} className={claseCampo} />
        </div>
      </div>
      <MensajeFormulario estado={estado} />
      <button type="submit" disabled={pendiente} className={claseBoton}>{pendiente ? "Registrando…" : "Registrar lote"}</button>
    </form>
  );
}
