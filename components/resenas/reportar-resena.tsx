"use client";

import { Flag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claseCampo } from "@/components/ui-formulario";
import { reportarResena } from "@/lib/actions/resenas";
import { MAX_DETALLE_REPORTE, MOTIVOS_REPORTE, type MotivoReporte, NOMBRE_MOTIVO } from "@/lib/resenas";
import { cn } from "@/lib/utils";

// RN-95: reportar una reseña ajena. Primero un botón pequeño; al abrirlo, el motivo y un detalle opcional en el mismo
// lugar. Una vez enviado (o si ya la había reportado), queda el aviso "Reportada" y no se ofrece otra vez.
export function ReportarResena({ idResena, yaReportada }: { idResena: number; yaReportada: boolean }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<MotivoReporte | "">("");
  const [detalle, setDetalle] = useState("");
  const [hecho, setHecho] = useState(yaReportada);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (hecho) return <p className="text-xs text-muted-foreground">Reportaste esta reseña. El personal la revisará.</p>;
  if (!abierto) {
    return (
      <Button type="button" size="xs" variant="ghost" onClick={() => setAbierto(true)} className="text-muted-foreground">
        <HugeiconsIcon icon={Flag01Icon} aria-hidden="true" />
        Reportar
      </Button>
    );
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo) return setError("Elige un motivo.");
    iniciar(async () => {
      const r = await reportarResena(idResena, motivo, detalle);
      if (!r.ok) return setError(r.error);
      setHecho(true);
    });
  }

  return (
    <form onSubmit={enviar} className="mt-2 space-y-2 rounded-xl border border-border p-3">
      <label htmlFor={`${id}-motivo`} className="block text-xs font-medium">¿Por qué la reportas?</label>
      <select id={`${id}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoReporte)} autoFocus
              className={cn(claseCampo, "mt-0 h-9")}>
        <option value="">Elige un motivo</option>
        {MOTIVOS_REPORTE.map((m) => <option key={m} value={m}>{NOMBRE_MOTIVO[m]}</option>)}
      </select>
      <label htmlFor={`${id}-detalle`} className="block text-xs font-medium">Detalle <span className="font-normal text-muted-foreground">(opcional)</span></label>
      <input id={`${id}-detalle`} value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={MAX_DETALLE_REPORTE}
             className={cn(claseCampo, "mt-0 h-9")} />
      <div className="flex gap-2">
        <Button type="submit" size="xs" variant="outline" disabled={pendiente}>{pendiente ? "Enviando…" : "Enviar reporte"}</Button>
        <Button type="button" size="xs" variant="ghost" disabled={pendiente} onClick={() => { setAbierto(false); setError(null); }}>Cancelar</Button>
      </div>
      {error && <p role="alert" className="text-xs text-danger-texto">{error}</p>}
    </form>
  );
}
