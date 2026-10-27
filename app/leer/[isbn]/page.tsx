import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VisorPdf } from "@/components/visor-pdf";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import { esIsbnValido } from "@/lib/isbn";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Leer en línea" };

// RN-29: la página comprueba el acceso para mostrar el visor; el archivo lo vuelve a comprobar su propia ruta
// (app/leer/[isbn]/archivo/route.ts), porque cualquiera puede pedir esa URL sin pasar por aquí.
export default async function PaginaLeer({ params }: PageProps<"/leer/[isbn]">) {
  const { isbn } = await params;
  // RN-83: la ruta para volver después del login. encodeURIComponent: el isbn viene de la URL.
  const lector = await exigirLector(`/leer/${encodeURIComponent(isbn)}`);
  if (!esIsbnValido(isbn)) notFound();
  const acceso = await obtenerAccesoDeLectura(lector.idLector, isbn);
  if (!acceso) notFound(); // sin préstamo vigente ni compra: igual que si no existiera

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link href={`/libros/${isbn}`} className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
        ← Volver al libro
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{acceso.titulo}</h1>
      <p className="mt-1 mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        {acceso.por === "compra" ? "Comprado: acceso permanente." : `Préstamo digital hasta el ${acceso.fin}.`}{" "}
        Solo se lee aquí, con tu cuenta.
      </p>
      <VisorPdf url={`/leer/${isbn}/archivo`} titulo={acceso.titulo} />
    </div>
  );
}
