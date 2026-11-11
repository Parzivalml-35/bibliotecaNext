import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonLampara, LamparaDeEsquina } from "@/components/boton-lampara";
import { Visor } from "@/components/visor";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import type { FormatoDigital } from "@/lib/definitions";
import { esIsbnValido } from "@/lib/isbn";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Leer en línea" };

const NOMBRE_FORMATO: Record<FormatoDigital, string> = { epub: "EPUB", pdf: "PDF" };

// RN-29: la página comprueba el acceso para mostrar el visor; el archivo lo vuelve a comprobar su propia ruta
// (app/leer/[isbn]/archivo/[formato]/route.ts), porque cualquiera puede pedir esa URL sin pasar por aquí.
// R5d, visor inmersivo (DI-10): esta ruta está fuera de app/(sitio), así que no lleva la barra de la app. Su barra
// mínima (volver, título, tema) la pone la propia página: es la única que tiene el título del libro.
// DI-06 (R8d): si el título tiene EPUB se abre ese (el texto se acomoda a la pantalla y toma el tema); el PDF queda
// como "Ver en PDF" (?formato=pdf). Un ?formato= que no sea una edición del título se ignora.
export default async function PaginaLeer({ params, searchParams }: PageProps<"/leer/[isbn]">) {
  const { isbn } = await params;
  const { formato: pedido } = await searchParams;
  // RN-83: la ruta para volver después del login. encodeURIComponent: el isbn viene de la URL.
  const lector = await exigirLector(`/leer/${encodeURIComponent(isbn)}`);
  if (!esIsbnValido(isbn)) notFound();
  const acceso = await obtenerAccesoDeLectura(lector.idLector, isbn);
  if (!acceso) notFound(); // sin préstamo vigente ni compra: igual que si no existiera
  const formatos = acceso.ediciones.map((e) => e.formato);
  // El pedido solo vale si es un formato que este título tiene: así no hace falta otra lista permitida.
  const formato = formatos.find((f) => f === pedido) ?? (formatos.includes("epub") ? "epub" : formatos[0]);
  const otro = formatos.find((f) => f !== formato); // el formato al que se puede cambiar, si hay

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
        <div className="mx-auto w-full max-w-5xl space-y-3 px-2 py-4 sm:px-6">
          {otro && (
            <p className="text-right text-sm text-muted-foreground">
              Estás leyendo en {NOMBRE_FORMATO[formato]}.{" "}
              {/* <a> y no <Link> (RN-84): navegación completa, como los enlaces "Leer". */}
              <a href={`/leer/${isbn}${otro === "epub" ? "" : `?formato=${otro}`}`}
                 className="font-medium text-primary underline-offset-4 hover:underline">
                Ver en {NOMBRE_FORMATO[otro]}
              </a>
            </p>
          )}
          <Visor formato={formato} url={`/leer/${isbn}/archivo/${formato}`} titulo={acceso.titulo} />
        </div>
      </main>
    </>
  );
}
