import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partesDeAvance, porcentajeDeAvance } from "@/components/cuenta/avance-lectura";
import { NotasDelLibro } from "@/components/cuenta/notas-del-libro";
import { PaginaAlcanzada } from "@/components/cuenta/pagina-alcanzada";
import { Portada } from "@/components/portada";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import {
  type HechoDelLibro,
  historiaDelLibro,
  limitesDeLectura,
  listarAnotaciones,
  listarLibrosLeidos,
  listarNotasLibres,
  listarSesiones,
  type SesionDeLectura,
} from "@/lib/data/lectura";
import { obtenerLibroPorIsbn } from "@/lib/data/libros";
import { esIsbnValido } from "@/lib/isbn";
import { enOrdenDelLibro } from "@/lib/lectura";
import { exigirLector } from "@/lib/sesion";

// generateMetadata: el título de la pestaña del navegador con el nombre del libro. obtenerLibroPorIsbn está en cache():
// la página la vuelve a pedir y no se repite la consulta. Sin datos del lector aquí (el título del libro es público).
export async function generateMetadata({ params }: PageProps<"/cuenta/lecturas/[isbn]">): Promise<Metadata> {
  const { isbn } = await params;
  const libro = esIsbnValido(isbn) ? await obtenerLibroPorIsbn(isbn) : null;
  return { title: libro ? `${libro.titulo} · Mis lecturas` : "Mis lecturas" };
}

const SESIONES_VISIBLES = 10; // se muestran las últimas; el tiempo total cuenta todas

// /cuenta/lecturas/[isbn] (RN-89, R10-F parte 2b): todo lo del lector con UN libro.
//  - El libro se busca ENTRE LOS DEL LECTOR (listarLibrosLeidos, cache()): uno que no tuvo da 404, igual que uno que no
//    existe. Todas las consultas filtran por el lector de la sesión (RN-87).
//  - Columna "el libro": ficha, avance (en línea y en papel), tiempo leído y su historia (reservas, préstamos,
//    compras), con la página alcanzada en cada préstamo físico (RN-90).
//  - Columna "lo tuyo": el panel de notas del visor (notas libres y resaltados).
// Desde xl (1280 px) van lado a lado; antes, una debajo de la otra.
export default async function PaginaLecturaDeLibro({ params }: PageProps<"/cuenta/lecturas/[isbn]">) {
  const { isbn } = await params;
  // RN-83: volver aquí después del login. encodeURIComponent: el isbn viene de la URL.
  const lector = await exigirLector(`/cuenta/lecturas/${encodeURIComponent(isbn)}`);
  if (!esIsbnValido(isbn)) notFound();
  const libro = (await listarLibrosLeidos(lector.idLector)).find((l) => l.isbn === isbn);
  if (!libro) notFound();

  // Todo lo demás no depende entre sí: siete consultas a la vez.
  const [ficha, acceso, historia, notas, anotaciones, sesiones, limites] = await Promise.all([
    obtenerLibroPorIsbn(isbn),
    obtenerAccesoDeLectura(lector.idLector, isbn), // la misma regla de acceso que /leer
    historiaDelLibro(lector.idLector, libro.id_libro),
    listarNotasLibres(lector.idLector, libro.id_libro),
    listarAnotaciones(lector.idLector, libro.id_libro),
    listarSesiones(lector.idLector, libro.id_libro),
    limitesDeLectura(),
  ]);
  const porcentaje = porcentajeDeAvance(libro);
  const segundosTotales = sesiones.reduce((suma, s) => suma + s.segundos, 0);

  return (
    <>
      {/* En el celular la lista está oculta con un libro elegido: este enlace vuelve a ella. */}
      <Link href="/cuenta/lecturas" className="mb-3 inline-block text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
        ← Mis lecturas
      </Link>

      <div className="xl:grid xl:grid-cols-2 xl:gap-6">
        {/* ---- El libro ---- */}
        <section aria-labelledby="titulo-libro" className="space-y-5">
          <div className="flex gap-4">
            {/* La portada generada del proyecto (components/portada.tsx); w-24 = 6 rem; shrink-0: no se aplasta. */}
            <Portada isbn={isbn} titulo={libro.titulo} autores={libro.autores ?? ""} className="w-24 shrink-0" />
            <div className="min-w-0">
              <h1 id="titulo-libro" className="font-heading text-2xl font-bold tracking-tight">{libro.titulo}</h1>
              {libro.autores && <p className="text-muted-foreground">{libro.autores}</p>}
              {ficha && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {[ficha.editorial, ficha.anio_publicacion, libro.paginas ? `${libro.paginas} páginas` : null].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {acceso ? (
                  // <a> y no <Link> (RN-84): a /leer se entra con navegación completa. El visor sigue donde quedó (RN-88).
                  <a href={`/leer/${isbn}`} className={buttonVariants({ size: "sm" })}>Seguir leyendo</a>
                ) : (
                  // DI-09: warning = algo que limita; el texto dice qué se puede hacer (el color nunca va solo).
                  // h-auto whitespace-normal: el Badge de shadcn es de una línea (alto fijo, nowrap); este texto es largo y
                  // en el celular desbordaba la pantalla. Aquí puede partirse en dos líneas.
                  <Badge variant="warning" className="h-auto py-1 whitespace-normal">Sin acceso en línea: ves tus notas y puedes escribir nuevas</Badge>
                )}
                <Link href={`/libros/${isbn}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver en el catálogo</Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Tu avance</h2>
            {porcentaje !== null && (
              <div role="progressbar" aria-label={`Avance en ${libro.titulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje}
                   className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                {/* El ancho calculado va en style: Tailwind no genera una clase por cada porcentaje. */}
                <div className="h-full rounded-full bg-primary" style={{ width: `${porcentaje}%` }} />
              </div>
            )}
            <ul className="mt-2 space-y-0.5 text-sm">
              {partesDeAvance(libro).map((p) => <li key={p}>{p}</li>)}
              {partesDeAvance(libro).length === 0 && <li className="text-muted-foreground">Sin avance registrado todavía.</li>}
              {segundosTotales > 0 && <li className="text-muted-foreground">Tiempo leído en línea: {duracion(segundosTotales)}</li>}
            </ul>
            {sesiones.length > 0 && <Sesiones sesiones={sesiones} />}
          </div>

          <div>
            <h2 className="text-sm font-medium">Tu historia con este libro</h2>
            <Historia hechos={historia} paginas={libro.paginas} />
          </div>
        </section>

        {/* ---- Lo tuyo ---- mt-8: separado de la ficha cuando van una debajo de otra; xl:mt-0: lado a lado. */}
        <section aria-label="Tus notas y resaltados" className="mt-8 rounded-2xl border border-border bg-card xl:mt-0 xl:self-start">
          <NotasDelLibro isbn={isbn} notas={notas} resaltados={enOrdenDelLibro(anotaciones)} maxNota={limites.max_caracteres_nota}
                         conAcceso={acceso !== null} />
        </section>
      </div>
    </>
  );
}

// "1 h 05 min", "12 min" o "menos de 1 min".
function duracion(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 1) return "menos de 1 min";
  const h = Math.floor(minutos / 60);
  return h > 0 ? `${h} h ${String(minutos % 60).padStart(2, "0")} min` : `${minutos} min`;
}
const porciento = (f: number) => `${Math.round(f * 100)} %`;

// Las sesiones de lectura en línea (RN-88), plegables con <details> (nativo, sin JavaScript).
function Sesiones({ sesiones }: { sesiones: SesionDeLectura[] }) {
  return (
    <details className="mt-3 border-t border-border pt-2">
      <summary className="cursor-pointer text-sm text-muted-foreground marker:text-muted-foreground">
        Sesiones de lectura en línea ({sesiones.length})
      </summary>
      {/* divide-y: una línea fina entre filas. tabular-nums: las cifras alineadas en columna. */}
      <ul className="mt-1 divide-y divide-border text-sm tabular-nums">
        {sesiones.slice(0, SESIONES_VISIBLES).map((s, i) => (
          <li key={i} className="flex flex-wrap justify-between gap-x-4 py-1.5">
            <span>{s.inicio}</span>
            <span className="text-muted-foreground">
              {duracion(s.segundos)} · {s.formato.toUpperCase()} · {porciento(s.progreso_inicial)} → {porciento(s.progreso_final)}
            </span>
          </li>
        ))}
        {sesiones.length > SESIONES_VISIBLES && (
          <li className="py-1.5 text-xs text-muted-foreground">Las {SESIONES_VISIBLES} más recientes de {sesiones.length}.</li>
        )}
      </ul>
    </details>
  );
}

const ESTADO_RESERVA: Record<string, string> = {
  activa: "en espera",
  asignada: "lista para ti",
  cumplida: "se convirtió en préstamo",
  vencida: "venció",
  cancelada: "cancelada",
};

// La historia (RN-89) como una línea de tiempo: <ol> (el orden importa), lo más reciente arriba. Cada hecho dice qué
// fue, cuándo y dónde. El préstamo físico trae además la página alcanzada (RN-90), que el lector puede informar.
function Historia({ hechos, paginas }: { hechos: HechoDelLibro[]; paginas: number | null }) {
  if (hechos.length === 0) return <p className="mt-2 text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  return (
    // border-l + pl: la línea vertical de la línea de tiempo; cada punto (::before no hace falta: un <span>) cuelga de ella.
    <ol className="mt-3 space-y-4 border-l border-border pl-4">
      {hechos.map((h, i) => (
        <li key={i} className="relative">
          {/* El punto sobre la línea: absolute, corrido a la izquierda lo justo para quedar centrado en el borde. */}
          <span aria-hidden="true" className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full border-2 border-card bg-primary" />
          <p className="text-sm font-medium">{tituloDe(h)}</p>
          <p className="text-xs text-muted-foreground">{detalleDe(h)}</p>
          {h.tipo === "prestamo_fisico" && <PaginaAlcanzada idPrestamo={h.id_prestamo} pagina={h.pagina} paginas={paginas} />}
        </li>
      ))}
    </ol>
  );
}

function tituloDe(h: HechoDelLibro): string {
  switch (h.tipo) {
    case "reserva_fisica": return `Reserva física en ${h.sede}`;
    case "prestamo_fisico": return `Préstamo físico en ${h.sede}`;
    case "reserva_digital": return "Reserva digital";
    case "prestamo_digital": return "Préstamo digital";
    case "compra_digital": return "Compra digital";
    case "compra_fisica": return "Compra del libro impreso";
  }
}

// Gracias a la unión discriminada, dentro de cada `case` TypeScript sabe qué campos tiene `h`.
function detalleDe(h: HechoDelLibro): string {
  switch (h.tipo) {
    case "reserva_fisica":
    case "reserva_digital":
      return `${h.fecha} · ${ESTADO_RESERVA[h.estado] ?? h.estado}${h.cierre ? ` (${h.cierre})` : ""}`;
    case "prestamo_fisico": {
      const renovado = h.renovaciones > 0 ? ` · renovado ${h.renovaciones} ${h.renovaciones === 1 ? "vez" : "veces"}` : "";
      return h.devuelto
        ? `${h.fecha} · devuelto el ${h.devuelto}${h.sede_devolucion ? ` en ${h.sede_devolucion}` : ""}${renovado}`
        : `${h.fecha} · vence el ${h.vence}${renovado}`;
    }
    case "prestamo_digital":
      return h.devuelto ? `${h.fecha} · devuelto el ${h.devuelto}` : `${h.fecha} · hasta el ${h.fin}`;
    case "compra_digital":
      return `${h.fecha}${h.primera_lectura ? ` · lo abriste por primera vez el ${h.primera_lectura}` : " · todavía sin abrir"}`;
    case "compra_fisica":
      return `${h.fecha} · ${h.modalidad === "envio" ? "enviado a domicilio" : "recogido en la sede"}`;
  }
}
