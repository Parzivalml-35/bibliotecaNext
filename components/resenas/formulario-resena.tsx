"use client";

import { useId, useState, useTransition } from "react";
import { IconoEstrella } from "@/components/resenas/estrellas";
import { Button } from "@/components/ui/button";
import { borrarResena, guardarResena } from "@/lib/actions/resenas";
import type { MiResena } from "@/lib/data/resenas";
import { cn } from "@/lib/utils";

// RN-94: escribir o editar la reseña propia (una por libro). Lo usan la ficha del libro y la tarjeta "Tu opinión" de
// "Mis lecturas". Client Component: las estrellas cambian al elegir, el contador de caracteres y la espera de la acción.
// La acción valida todo de nuevo (estrellas, recomienda, largo); aquí solo se ayuda.
//
// Las estrellas son RADIOS nativos (una sola opción de cinco): el teclado funciona solo (flechas para cambiar, Tab para
// salir del grupo) y el lector de pantalla anuncia "3 estrellas, botón de opción, 3 de 5". El <input> va oculto con
// sr-only (sigue siendo enfocable) y la estrella dibujada es su <label>.
export function FormularioResena({ isbn, actual, maximo }: { isbn: string; actual: MiResena | null; maximo: number }) {
  const id = useId(); // los ids no se repiten aunque haya dos formularios en la página
  const [estrellas, setEstrellas] = useState(actual?.estrellas ?? 0);
  const [recomienda, setRecomienda] = useState<boolean | null>(actual?.recomienda ?? null);
  const [texto, setTexto] = useState(actual?.texto ?? "");
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string } | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const caracteres = Array.from(texto).length; // cuenta letras, no unidades de UTF-16 (igual que la acción)

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (estrellas === 0) return setMensaje({ error: true, texto: "Elige de 1 a 5 estrellas." });
    if (recomienda === null) return setMensaje({ error: true, texto: "Di si lo recomendarías." });
    iniciar(async () => {
      const r = await guardarResena(isbn, { estrellas, recomienda, texto });
      setMensaje(r.ok ? { error: false, texto: actual ? "Reseña actualizada." : "¡Gracias! Tu reseña ya está publicada." } : { error: true, texto: r.error });
    });
  }

  function borrar() {
    iniciar(async () => {
      const r = await borrarResena(isbn);
      if (!r.ok) return setMensaje({ error: true, texto: r.error });
      setConfirmarBorrado(false);
      setEstrellas(0); setRecomienda(null); setTexto("");
      setMensaje({ error: false, texto: "Borraste tu reseña." });
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      {actual?.oculta && (
        // RN-95: su autor la ve marcada. Editarla no la vuelve a publicar (la acción no toca fecha_ocultada).
        <p className="rounded-xl border border-warning/40 bg-warning-suave px-3 py-2 text-sm text-warning-texto">
          Tu reseña está oculta por moderación: no la ven los demás. Puedes editarla o borrarla.
        </p>
      )}
      <fieldset>
        <legend className="text-sm font-medium">Tu calificación</legend>
        {/* has-[:focus-visible]: el anillo de foco va en la estrella cuyo radio (oculto) tiene el foco del teclado. */}
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
              <input type="radio" name={`${id}-estrellas`} value={n} checked={estrellas === n} onChange={() => setEstrellas(n)}
                     className="sr-only" />
              <span className="sr-only">{n === 1 ? "1 estrella" : `${n} estrellas`}</span>
              <IconoEstrella className={cn("size-7 transition-colors", n <= estrellas ? "text-primary" : "text-muted-foreground/35")} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">¿Lo recomendarías?</legend>
        <div className="mt-1 flex gap-4 text-sm">
          {/* accent-primary: el color del radio nativo con el acento del tema. */}
          <label className="flex items-center gap-1.5">
            <input type="radio" name={`${id}-recomienda`} checked={recomienda === true} onChange={() => setRecomienda(true)} className="accent-primary" />
            Sí
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name={`${id}-recomienda`} checked={recomienda === false} onChange={() => setRecomienda(false)} className="accent-primary" />
            No
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-texto`} className="text-sm font-medium">Tu reseña <span className="font-normal text-muted-foreground">(opcional)</span></label>
        <textarea id={`${id}-texto`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
                  aria-describedby={`${id}-cuenta`} placeholder="¿Qué te gustó? ¿A quién se lo recomendarías? Evita contar el final."
                  className="mt-1 w-full rounded-2xl border border-borde-campo bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
        <p id={`${id}-cuenta`} className={cn("text-right text-xs tabular-nums", caracteres > maximo ? "text-danger-texto" : "text-muted-foreground")}>
          {caracteres} / {maximo}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pendiente || caracteres > maximo}>
          {pendiente ? "Guardando…" : actual ? "Guardar cambios" : "Publicar reseña"}
        </Button>
        {actual && !confirmarBorrado && (
          <Button type="button" size="sm" variant="ghost" disabled={pendiente} onClick={() => setConfirmarBorrado(true)}
                  className="text-danger-texto hover:bg-danger-suave">
            Borrar mi reseña
          </Button>
        )}
        {actual && confirmarBorrado && (
          // Borrar no se deshace: se confirma en el mismo lugar (como las notas).
          <span role="group" aria-label="Confirmar borrado" className="flex flex-wrap items-center gap-1.5 text-sm">
            ¿Borrarla?
            <Button type="button" size="xs" variant="destructive" disabled={pendiente} onClick={borrar} autoFocus>Sí, borrar</Button>
            <Button type="button" size="xs" variant="ghost" disabled={pendiente} onClick={() => setConfirmarBorrado(false)}>No</Button>
          </span>
        )}
      </div>
      {/* aria-live: el resultado se anuncia sin mover el foco. Siempre en la página (vacío al principio). */}
      <p aria-live="polite" className={cn("text-sm", mensaje?.error ? "text-danger-texto" : "text-success-texto")}>{mensaje?.texto}</p>
    </form>
  );
}
