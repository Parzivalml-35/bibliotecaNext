import Link from "next/link";
import { InsigniaDisponibilidad } from "@/components/insignia-disponibilidad";
import { InsigniaSeccion } from "@/components/insignia-seccion";
import { Portada } from "@/components/portada";
import type { LibroResumen } from "@/lib/definitions";

type TarjetaLibroProps = {
  libro: LibroResumen;
};

// Tarjeta de un libro en el catálogo. Server Component: no tiene interacción,
// así que no necesita "use client" y no envía JavaScript al navegador.
// Bloque de DI-08 (borde fino, sin sombra) con la portada generada (DI-05) a la izquierda. No usa <Card> porque
// Card apila en columna con su propio espaciado; aquí la portada y el texto van en fila.
export function TarjetaLibro({ libro }: TarjetaLibroProps) {
  return (
    // relative: referencia para el ::after del enlace, que se estira sobre toda la tarjeta.
    // hover:border-primary: al pasar el mouse el borde toma el color del tema ("tarjeta seleccionada" de DI-08).
    // has-[a:focus-visible]: el anillo de foco aparece en la tarjeta cuando se llega al enlace con el teclado.
    <article className="relative flex h-full gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring">
      <Portada isbn={libro.isbn} titulo={libro.titulo} autores={libro.autores} className="w-20 shrink-0 self-start" />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h2 className="text-lg leading-snug font-semibold">
            {/* Un solo enlace por tarjeta (el título): su ::after cubre toda la tarjeta y la hace clicable. */}
            <Link href={`/libros/${libro.isbn}`} className="after:absolute after:inset-0 focus:outline-none">
              {libro.titulo}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{libro.autores}</p>
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
