import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partesDeAvance } from "@/components/cuenta/avance-lectura";
import { listarLibrosLeidos } from "@/lib/data/lectura";
import { esIsbnValido } from "@/lib/isbn";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mis lecturas" };

// /cuenta/lecturas/[isbn] (RN-89): el detalle de un libro. R10-F parte 2a: mínimo (la 2b agrega la ficha, la historia,
// la página alcanzada y las notas). El libro se busca ENTRE LOS DEL LECTOR (listarLibrosLeidos, con cache()): un ISBN
// de un libro que no tuvo da 404, igual que uno que no existe (no se revela nada de otros lectores).
export default async function PaginaLecturaDeLibro({ params }: PageProps<"/cuenta/lecturas/[isbn]">) {
  const { isbn } = await params;
  // RN-83: volver aquí después del login. encodeURIComponent: el isbn viene de la URL.
  const lector = await exigirLector(`/cuenta/lecturas/${encodeURIComponent(isbn)}`);
  if (!esIsbnValido(isbn)) notFound();
  const libro = (await listarLibrosLeidos(lector.idLector)).find((l) => l.isbn === isbn);
  if (!libro) notFound();

  return (
    <>
      {/* En el celular la lista está oculta con un libro elegido: este enlace vuelve a ella. */}
      <Link href="/cuenta/lecturas" className="mb-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
        ← Mis lecturas
      </Link>
      <h1 className="font-heading text-2xl font-bold tracking-tight">{libro.titulo}</h1>
      {libro.autores && <p className="text-muted-foreground">{libro.autores}</p>}
      <ul className="mt-3 text-sm">
        {partesDeAvance(libro).map((p) => <li key={p}>{p}</li>)}
      </ul>
    </>
  );
}
