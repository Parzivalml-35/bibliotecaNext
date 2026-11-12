import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/estado-vacio";
import { buttonVariants } from "@/components/ui/button";
import { listarLibrosLeidos } from "@/lib/data/lectura";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mis lecturas" };

// /cuenta/lecturas (RN-89): el título de la sección. La lista la pone el layout (al lado en el escritorio, debajo en
// el celular). En el escritorio, el espacio del detalle invita a elegir un libro.
export default async function PaginaLecturas() {
  const lector = await exigirLector("/cuenta/lecturas"); // RN-83
  const libros = await listarLibrosLeidos(lector.idLector); // cache(): la misma consulta que ya hizo la lista

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Mis lecturas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada libro que tuviste, prestado o comprado: tu historia con él, cuánto avanzaste, tus notas y lo que marcaste.
        Solo tú lo ves.
      </p>
      {libros.length === 0 ? (
        <EstadoVacio className="mt-4" accion={<Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>Buscar un libro</Link>}>
          Todavía no tienes libros aquí. Cuando pidas prestado o compres uno, aparece con su historia.
        </EstadoVacio>
      ) : (
        // Solo en el escritorio (en el celular la lista está justo debajo y basta).
        <div className="mt-6 hidden rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground lg:block">
          Elige un libro de la lista para ver su historia, tu avance y tus notas.
        </div>
      )}
    </>
  );
}
