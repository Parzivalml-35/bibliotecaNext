import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonLampara, LamparaDeEsquina } from "@/components/boton-lampara";
import { EnlaceLogo } from "@/components/marca/enlace-logo";
import { Portada } from "@/components/portada";
import { type FichaLibro, Visor } from "@/components/visor";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import { obtenerLibroPorIsbn } from "@/lib/data/libros";
import { limitesDeLectura, listarAnotaciones, listarNotasLibres, obtenerPosicion } from "@/lib/data/lectura";
import type { FormatoDigital, LibroDetalle } from "@/lib/definitions";
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
// Lector inmersivo: con EPUB, la página es SOLO el visor a pantalla completa (la barra lateral trae volver, título y
// lámpara). Con PDF se mantiene la cápsula de arriba.
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

  // La ficha del libro para el visor. obtenerLibroPorIsbn está en cache(): si otra parte de la petición ya lo pidió, no
  // vuelve a consultar. Si no lo encontrara (no debería: el acceso ya lo encontró), se usan los datos del acceso.
  const libro = await obtenerLibroPorIsbn(isbn);
  const autores = libro?.autores.map((a) => `${a.nombre} ${a.apellido}`).join(", ") ?? "";
  const ficha: FichaLibro = {
    isbn,
    titulo: acceso.titulo,
    autores,
    acceso: acceso.por === "compra" ? "Comprado: acceso permanente" : `Préstamo digital hasta el ${acceso.fin}`,
    // <a> y no <Link> en quien lo use (RN-84): cambiar de formato vuelve a entrar a /leer y necesita su CSP.
    otroFormato: otro ? { href: `/leer/${isbn}${otro === "epub" ? "" : `?formato=${otro}`}`, nombre: NOMBRE_FORMATO[otro] } : null,
  };
  // La portada se dibuja AQUÍ, en el servidor, y viaja al visor (Client Component) como JSX ya armado.
  const portada = <Portada isbn={isbn} titulo={acceso.titulo} autores={autores} className="w-full" />;
  // "Detalles del libro" (diálogo del visor EPUB): datos del catálogo, también dibujados aquí.
  const detalles = libro && (
    <DetallesDelLibro libro={libro} formatos={formatos.map((f) => NOMBRE_FORMATO[f]).join(" y ")} />
  );
  // RN-85 a RN-88, todo del lector de la SESIÓN (id_lector): las marcas y las notas libres (solo en el EPUB), dónde
  // quedó en ESTE formato (para seguir ahí) y los límites (largo de la nota, cada cuánto avisa el latido). Las cuatro
  // consultas no dependen una de otra: Promise.all las lanza a la vez.
  const esEpub = formato === "epub";
  const [anotaciones, notas, posicion, limites] = await Promise.all([
    esEpub ? listarAnotaciones(lector.idLector, acceso.id_libro) : [],
    esEpub ? listarNotasLibres(lector.idLector, acceso.id_libro) : [],
    obtenerPosicion(lector.idLector, acceso.id_libro, formato),
    limitesDeLectura(),
  ]);
  const lectura = {
    anotaciones,
    notas,
    maxNota: limites.max_caracteres_nota,
    posicion,
    latido: { segundos: limites.segundos_latido_lectura, minutosInactividad: limites.minutos_inactividad_lectura },
  };
  const visor = <Visor formato={formato} url={`/leer/${isbn}/archivo/${formato}`} ficha={ficha} portada={portada} detalles={detalles} lectura={lectura} />;

  if (esEpub) return visor;

  return (
    <>
      {/* La misma cápsula flotante que la barra del sitio (DI-02), con el emblema en pequeño (DI-13: siempre visible;
          aquí no cuelga de la cápsula, porque manda el libro).
          sticky top-3: queda arriba al desplazarse por una página larga. z-40: por encima del canvas. */}
      <header className="sticky top-3 z-40 my-3 px-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 rounded-full border border-border bg-card/85 py-1.5 pr-2 pl-3 backdrop-blur">
          <EnlaceLogo />
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
          {ficha.otroFormato && (
            <p className="text-right text-sm text-muted-foreground">
              Estás leyendo en {NOMBRE_FORMATO[formato]}.{" "}
              {/* <a> y no <Link> (RN-84): navegación completa, como los enlaces "Leer". */}
              <a href={ficha.otroFormato.href} className="font-medium text-primary underline-offset-4 hover:underline">
                Ver en {ficha.otroFormato.nombre}
              </a>
            </p>
          )}
          {visor}
        </div>
      </main>
    </>
  );
}

// Los datos del catálogo para "Detalles del libro". Server Component (sin "use client"): se dibuja aquí y el visor lo
// recibe hecho. <dl> (lista de descripciones): cada dato es un par término (<dt>) y valor (<dd>), que es lo que es.
function DetallesDelLibro({ libro, formatos }: { libro: LibroDetalle; formatos: string }) {
  const generos = [libro.genero, ...libro.generos_secundarios].join(", ");
  const datos: [string, string][] = [
    ["Editorial", libro.editorial],
    ["Publicado", libro.anio_publicacion ? String(libro.anio_publicacion) : "Sin dato"],
    ["ISBN", libro.isbn],
    ["Géneros", generos],
    ["Clasificación", libro.clasificacion],
    ["Formatos digitales", formatos],
  ];
  return (
    <div className="space-y-4">
      {/* grid-cols-2 (3 desde sm): los datos en columnas, como en la ficha de Readest. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {datos.map(([termino, valor]) => (
          <div key={termino} className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{termino}</dt>
            <dd className="mt-0.5 break-words">{valor}</dd>
          </div>
        ))}
      </dl>
      {libro.sinopsis && (
        // <details>/<summary>: plegable nativo del navegador, sin JavaScript. Empieza cerrado.
        <details className="group rounded-xl border border-border px-4 py-3">
          <summary className="cursor-pointer font-medium marker:text-muted-foreground">Sinopsis</summary>
          <p className="mt-2 leading-relaxed text-muted-foreground">{libro.sinopsis}</p>
        </details>
      )}
    </div>
  );
}
