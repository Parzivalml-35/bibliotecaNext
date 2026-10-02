"use client"; // Interactivo: reacciona a lo que se escribe. Es el único Client Component del catálogo.

import Form from "next/form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition, type ChangeEvent } from "react";
import type { Seccion } from "@/lib/definitions";

type BuscadorCatalogoProps = {
  texto: string; // valores actuales, ya normalizados y validados por la página (Server Component)
  seccion: string;
  secciones: Seccion[]; // datos del servidor: llegan por props, como a cualquier componente
};

const ESPERA_MS = 300; // debounce: buscar cuando se deja de escribir, no en cada tecla

// Mejora progresiva: sin JavaScript es un formulario GET normal (Enter o el botón Buscar).
// Con JavaScript, además, actualiza la URL mientras se escribe; la página (servidor) hace la búsqueda.
export function BuscadorCatalogo({ texto, seccion, secciones }: BuscadorCatalogoProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [buscando, iniciarTransicion] = useTransition();

  // useRef guarda valores que sobreviven entre renders SIN provocar un render nuevo al cambiar.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campoTexto = useRef<HTMLInputElement>(null);
  const campoSeccion = useRef<HTMLSelectElement>(null);

  // Arma la nueva URL a partir de la actual: solo cambia los valores de la query, nunca la ruta.
  function navegar(cambios: Record<string, string>) {
    const parametros = new URLSearchParams(searchParams.toString());
    for (const [nombre, valor] of Object.entries(cambios)) {
      const limpio = valor.trim();
      if (limpio) parametros.set(nombre, limpio);
      else parametros.delete(nombre); // sin ?q= vacío en la URL
    }
    const query = parametros.toString();
    // replace: no llena el historial con una entrada por pausa. scroll: false: la página no salta arriba.
    // startTransition: la navegación no bloquea la escritura y `buscando` indica que está en curso.
    iniciarTransicion(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function cancelarEspera() {
    if (temporizador.current) clearTimeout(temporizador.current);
  }

  function alEscribir(evento: ChangeEvent<HTMLInputElement>) {
    const valor = evento.target.value;
    cancelarEspera(); // cada tecla reinicia la cuenta
    temporizador.current = setTimeout(() => navegar({ q: valor }), ESPERA_MS);
  }

  // Si la URL cambia desde fuera ("Limpiar filtros", botón atrás), los campos se ponen al día,
  // pero solo si el usuario no está escribiendo en ellos (no se le pisa lo que teclea).
  useEffect(() => {
    const inputTexto = campoTexto.current;
    if (inputTexto && document.activeElement !== inputTexto && inputTexto.value !== texto) {
      inputTexto.value = texto;
    }
    const selectSeccion = campoSeccion.current;
    if (selectSeccion && document.activeElement !== selectSeccion && selectSeccion.value !== seccion) {
      selectSeccion.value = seccion;
    }
  }, [texto, seccion]);

  // Limpieza: si el componente se desmonta con un temporizador pendiente, se cancela.
  useEffect(() => cancelarEspera, []);

  const campo =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <Form action="/" role="search" onSubmit={cancelarEspera} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <label htmlFor="q" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Buscar
          </label>
          {/* role=status: el lector de pantalla anuncia "Buscando…" sin interrumpir */}
          <span role="status" className="text-xs text-zinc-500">
            {buscando ? "Buscando…" : ""}
          </span>
        </div>
        <input
          ref={campoTexto}
          id="q"
          name="q"
          type="search"
          defaultValue={texto}
          onChange={alEscribir}
          placeholder="Título o autor"
          maxLength={100}
          autoComplete="off"
          className={campo}
        />
      </div>

      <div className="sm:w-56">
        <label htmlFor="seccion" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sección
        </label>
        <select
          ref={campoSeccion}
          id="seccion"
          name="seccion"
          defaultValue={seccion}
          onChange={(evento) => navegar({ seccion: evento.target.value })} // elegir es un acto final: sin espera
          className={campo}
        >
          <option value="">Todas</option>
          {secciones.map((s) => (
            <option key={s.nombre} value={s.nombre}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white shadow-sm hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Buscar
      </button>
    </Form>
  );
}
