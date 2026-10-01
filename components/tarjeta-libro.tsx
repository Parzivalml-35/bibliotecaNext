import Link from "next/link";
import { InsigniaDisponibilidad } from "@/components/insignia-disponibilidad";
import { InsigniaSeccion } from "@/components/insignia-seccion";
import type { LibroResumen } from "@/lib/definitions";

type TarjetaLibroProps = {
  libro: LibroResumen;
};

// Tarjeta de un libro en el catálogo. Server Component: no tiene interacción,
// así que no necesita "use client" y no envía JavaScript al navegador.
export function TarjetaLibro({ libro }: TarjetaLibroProps) {
  return (
    // relative: referencia para el ::after del enlace, que se estira sobre toda la tarjeta.
    // has-[a:focus-visible]: el anillo de foco aparece en la tarjeta cuando se llega al enlace con el teclado.
    <article className="relative flex h-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-blue-600 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Barra con el color de la sección (RN-18). El color viene de la BD: va en style, no en una clase. */}
      <div aria-hidden="true" className="w-2 shrink-0" style={{ backgroundColor: libro.color_hex }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
            {/* Un solo enlace por tarjeta (el título): su ::after cubre toda la tarjeta y la hace clicable. */}
            <Link href={`/libros/${libro.isbn}`} className="after:absolute after:inset-0 focus:outline-none">
              {libro.titulo}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{libro.autores}</p>
        </div>

        {/* mt-auto empuja esta fila al fondo: todas las tarjetas alinean su pie aunque el título ocupe más líneas. */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <InsigniaSeccion seccion={libro.seccion} color={libro.color_hex} detalle={libro.genero} />
          <InsigniaDisponibilidad cantidad={libro.disponibles} />
        </div>
      </div>
    </article>
  );
}
