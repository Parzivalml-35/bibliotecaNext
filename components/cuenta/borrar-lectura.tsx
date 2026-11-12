"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { borrarNota, borrarResaltado } from "@/lib/actions/lectura";

// "Mis lecturas" (R10-F, RN-87): borrar una nota libre o una marca, con o sin acceso al libro. Client Component solo
// por la interacción (confirmar, esperar la respuesta, mostrar el error); la página que lo usa es del servidor.
//
// Por qué no BotonAccion (el botón-formulario de las otras pestañas): estas acciones las comparte el visor EPUB, que
// las llama con valores simples y recibe un Resultado. Aquí se llaman igual, y al salir bien se pide al servidor la
// página de nuevo con router.refresh(): vuelve a ejecutar los Server Components (las consultas) y React mezcla el
// resultado SIN perder el estado del navegador (qué <details> están abiertos, el scroll).

export function BorrarLectura({ tipo, id }: { tipo: "nota" | "resaltado"; id: number }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // useTransition: `pendiente` es true mientras corre la acción Y el refresh (React lo trata como una sola transición);
  // así el botón no vuelve a habilitarse antes de que la tarjeta desaparezca.
  const [pendiente, iniciar] = useTransition();
  const que = tipo === "nota" ? "esta nota" : "esta marca";

  function borrar() {
    iniciar(async () => {
      const r = tipo === "nota" ? await borrarNota(id) : await borrarResaltado(id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  // Borrar no se deshace: se pide confirmar en el mismo lugar (como en el panel del visor).
  if (!confirmando) {
    return (
      <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmando(true)} className="text-danger-texto hover:bg-danger-suave">
        <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" />
        Borrar
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Confirmar borrado" className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs">¿Borrar {que}? No se puede deshacer.</span>
      <Button type="button" variant="destructive" size="xs" disabled={pendiente} autoFocus onClick={borrar}>
        {pendiente ? "Borrando…" : "Sí, borrar"}
      </Button>
      <Button type="button" variant="ghost" size="xs" disabled={pendiente} onClick={() => { setConfirmando(false); setError(null); }}>
        No
      </Button>
      {error && <p role="alert" className="w-full text-xs text-danger-texto">{error}</p>}
    </div>
  );
}
