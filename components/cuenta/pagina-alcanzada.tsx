"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claseCampo } from "@/components/ui-formulario";
import { cn } from "@/lib/utils";
import { guardarPaginaFisica } from "@/lib/actions/lectura";

// RN-90: "¿Hasta qué página llegaste?" en un préstamo físico de "Mis lecturas". Lo informa SOLO el lector (el
// bibliotecario registra la devolución sin preguntarlo). Se puede cambiar o quitar cuando quiera. La acción comprueba
// que el préstamo sea suyo y que la página no pase del libro; aquí min/max solo ayudan (el navegador avisa antes).
export function PaginaAlcanzada({ idPrestamo, pagina, paginas }: { idPrestamo: number; pagina: number | null; paginas: number | null }) {
  const router = useRouter();
  const id = useId();
  const [valor, setValor] = useState(pagina === null ? "" : String(pagina));
  const [mensaje, setMensaje] = useState<{ error: boolean; texto: string } | null>(null);
  // useTransition: `pendiente` cubre la acción Y el refresh (el avance de arriba se actualiza en la misma transición).
  const [pendiente, iniciar] = useTransition();

  function guardar(nueva: number | null) {
    iniciar(async () => {
      const r = await guardarPaginaFisica(idPrestamo, nueva);
      if (!r.ok) return setMensaje({ error: true, texto: r.error });
      setMensaje({ error: false, texto: nueva === null ? "Quitada." : "Guardada." });
      if (nueva === null) setValor("");
      router.refresh(); // el avance del libro y la lista se recalculan en el servidor
    });
  }

  return (
    // <form> con onSubmit: Enter en el campo guarda. preventDefault: no recarga la página (se usa la acción a mano).
    <form className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); guardar(valor.trim() === "" ? null : Number(valor)); }}>
      <label htmlFor={id} className="text-xs text-muted-foreground">¿Hasta qué página llegaste?</label>
      {/* claseCampo: el campo del proyecto (ui-formulario.tsx). type="number" + inputMode: teclado numérico en el celular.
          mt-0 h-8 w-24: sin el margen de arriba de los formularios, más bajo y de 6 rem (cabe un número de 4 cifras). */}
      <input id={id} type="number" inputMode="numeric" min={1} max={paginas ?? undefined} step={1} value={valor}
             onChange={(e) => setValor(e.target.value)} className={cn(claseCampo, "mt-0 h-8 w-24")} aria-describedby={`${id}-ayuda`} />
      <span id={`${id}-ayuda`} className="text-xs text-muted-foreground">{paginas ? `de ${paginas}` : ""}</span>
      <Button type="submit" size="xs" variant="outline" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
      {pagina !== null && (
        <Button type="button" size="xs" variant="ghost" disabled={pendiente} onClick={() => guardar(null)}>Quitar</Button>
      )}
      {/* aria-live: el resultado se anuncia sin mover el foco. */}
      <span aria-live="polite" className={mensaje?.error ? "w-full text-xs text-danger-texto" : "text-xs text-success-texto"}>
        {mensaje?.texto}
      </span>
    </form>
  );
}
