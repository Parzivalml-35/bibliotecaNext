import type { LibroResumen } from "@/lib/definitions";

type TarjetaLibroProps = {
  libro: LibroResumen;
};

// Tarjeta de un libro en el catálogo. Server Component: no tiene interacción,
// así que no necesita "use client" y no envía JavaScript al navegador.
export function TarjetaLibro({ libro }: TarjetaLibroProps) {
  return (
    <article className="flex h-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Barra con el color de la sección (RN-18). El color viene de la BD: va en style, no en una clase. */}
      <div aria-hidden="true" className="w-2 shrink-0" style={{ backgroundColor: libro.color_hex }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{libro.titulo}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{libro.autores}</p>
        </div>

        {/* mt-auto empuja esta fila al fondo: todas las tarjetas alinean su pie aunque el título ocupe más líneas. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: libro.color_hex }} />
            {libro.seccion} · {libro.genero}
          </span>
          <Disponibilidad cantidad={libro.disponibles} />
        </div>
      </div>
    </article>
  );
}

// Componente interno (no se exporta): solo lo usa la tarjeta.
function Disponibilidad({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) {
    return (
      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Sin copias disponibles
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      {cantidad} {cantidad === 1 ? "disponible" : "disponibles"}
    </span>
  );
}
