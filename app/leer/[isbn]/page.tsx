import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonLampara, LamparaDeEsquina } from "@/components/boton-lampara";
import { VisorPdf } from "@/components/visor-pdf";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import { esIsbnValido } from "@/lib/isbn";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Leer en línea" };

// RN-29: la página comprueba el acceso para mostrar el visor; el archivo lo vuelve a comprobar su propia ruta
// (app/leer/[isbn]/archivo/[formato]/route.ts), porque cualquiera puede pedir esa URL sin pasar por aquí.
// R5d, visor inmersivo (DI-10): esta ruta está fuera de app/(sitio), así que no lleva la barra de la app. Su barra
// mínima (volver, título, tema) la pone la propia página: es la única que tiene el título del libro.
export default async function PaginaLeer({ params }: PageProps<"/leer/[isbn]">) {
  const { isbn } = await params;
  // RN-83: la ruta para volver después del login. encodeURIComponent: el isbn viene de la URL.
  const lector = await exigirLector(`/leer/${encodeURIComponent(isbn)}`);
  if (!esIsbnValido(isbn)) notFound();
  const acceso = await obtenerAccesoDeLectura(lector.idLector, isbn);
  if (!acceso) notFound(); // sin préstamo vigente ni compra: igual que si no existiera
  // R8b: por ahora solo el visor PDF. R8d elegirá el EPUB si existe y dejará el PDF como "Ver en PDF" (DI-06).
  if (!acceso.ediciones.some((e) => e.formato === "pdf")) notFound();

  return (
    <>
      {/* La misma cápsula flotante que la barra del sitio (DI-02), sin el emblema: aquí manda el libro.
          sticky top-3: queda arriba al desplazarse por una página larga. z-40: por encima del canvas. */}
      <header className="sticky top-3 z-40 my-3 px-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 rounded-full border border-border bg-card/85 py-1.5 pr-2 pl-4 backdrop-blur">
          <Link href={`/libros/${isbn}`} className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Volver
          </Link>
          {/* min-w-0 + truncate: un título largo se corta con "…" en vez de empujar el botón del tema fuera. */}
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate font-heading text-base font-semibold">{acceso.titulo}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {acceso.por === "compra" ? "Comprado: acceso permanente" : `Préstamo digital hasta el ${acceso.fin}`} · solo se lee aquí, con tu cuenta
            </p>
          </div>
          {/* DI-03, igual que en el resto del sitio: en la barra por debajo de xl y en la esquina desde xl. */}
          <BotonLampara className="xl:hidden" />
        </div>
      </header>
      <LamparaDeEsquina />
      {/* Sin fondo propio: la pared y su luz (DI-14) se ven alrededor de la hoja, como en el resto de la app. */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-2 py-4 sm:px-6">
          <VisorPdf url={`/leer/${isbn}/archivo/pdf`} titulo={acceso.titulo} />
        </div>
      </main>
    </>
  );
}
