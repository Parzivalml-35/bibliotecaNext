"use client";

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cambiarTerminado } from "@/lib/actions/lectura";

// RN-93: "Terminé de leer" en "Mis lecturas". Marcarlo envía la encuesta (un aviso en la campana) si corresponde;
// desmarcarlo solo quita la marca. Client Component por la espera de la acción; la fecha llega del servidor.
export function TerminadoDeLeer({ isbn, terminado }: { isbn: string; terminado: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // `pendiente` cubre la acción y el refresh: el botón no cambia de texto antes de que llegue la fecha nueva.
  const [pendiente, iniciar] = useTransition();

  function cambiar(nuevo: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await cambiarTerminado(isbn, nuevo);
      if (!r.ok) return setError(r.error);
      router.refresh(); // la fecha, la lista y la campana (la encuesta nueva) vienen del servidor
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {terminado ? (
        <>
          {/* role="status": al marcarlo, el lector de pantalla anuncia el resultado. */}
          <p role="status" className="flex items-center gap-1.5 text-sm">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} aria-hidden="true" className="size-4 text-success-texto" />
            Lo terminaste el {terminado}.
          </p>
          <Button type="button" size="xs" variant="ghost" disabled={pendiente} onClick={() => cambiar(false)}>
            {pendiente ? "Quitando…" : "Desmarcar"}
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => cambiar(true)}>
          <HugeiconsIcon icon={CheckmarkCircle02Icon} aria-hidden="true" />
          {pendiente ? "Guardando…" : "Terminé de leer"}
        </Button>
      )}
      {error && <p role="alert" className="w-full text-xs text-danger-texto">{error}</p>}
    </div>
  );
}
