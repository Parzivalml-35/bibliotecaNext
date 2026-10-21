import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsigniaSeccion } from "@/components/insignia-seccion";
import { TarjetaSede } from "@/components/tarjeta-sede";
import { FormularioReserva } from "@/components/formularios-lector";
import { SeccionDigital } from "@/components/seccion-digital";
import { obtenerDisponibilidadDigital, obtenerSituacionDigitalEnTitulo } from "@/lib/data/digital";
import { obtenerReservaVivaDeObra } from "@/lib/data/lectores";
import { obtenerDisponibilidadPorSede, obtenerLibroPorIsbn } from "@/lib/data/libros";
import { obtenerUsuario } from "@/lib/sesion";
import type { DisponibilidadSede } from "@/lib/definitions";
import { plural } from "@/lib/formato";
import { esIsbnValido } from "@/lib/isbn";

// Busca el libro de la URL o corta con un 404. La usan generateMetadata y la página;
// gracias a cache() en obtenerLibroPorIsbn, la consulta corre una sola vez por petición.
async function libroDeLaUrl(isbn: string) {
  if (!esIsbnValido(isbn)) notFound(); // /libros/hola ni siquiera llega a la BD
  const libro = await obtenerLibroPorIsbn(isbn);
  if (!libro) notFound(); // ISBN con formato válido pero que no está en el catálogo
  return libro;
}

// Título y descripción propios de cada libro (pestaña del navegador, buscadores, enlaces compartidos).
export async function generateMetadata({ params }: PageProps<"/libros/[isbn]">): Promise<Metadata> {
  const { isbn } = await params;
  const libro = await libroDeLaUrl(isbn);
  const autores = libro.autores.map((a) => `${a.nombre} ${a.apellido}`).join(", ");
  return {
    title: libro.titulo,
    description: `${libro.titulo}, de ${autores}: disponibilidad por sede y ubicación en la red de bibliotecas.`,
  };
}

export default async function PaginaLibro({ params }: PageProps<"/libros/[isbn]">) {
  const { isbn } = await params; // en el App Router, params es una Promise
  const libro = await libroDeLaUrl(isbn);
  const [sedes, usuario] = await Promise.all([obtenerDisponibilidadPorSede(libro.id_libro), obtenerUsuario()]);
  const idLector = usuario?.lector?.idLector;
  const [reservaViva, digital, situacionDigital] = await Promise.all([
    idLector ? obtenerReservaVivaDeObra(idLector, libro.id_libro) : null,
    obtenerDisponibilidadDigital(libro.id_libro),
    idLector ? obtenerSituacionDigitalEnTitulo(idLector, libro.id_libro) : null,
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
        ← Volver al catálogo
      </Link>

      {/* Ficha del libro */}
      <article className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div aria-hidden="true" className="h-2" style={{ backgroundColor: libro.color_hex }} />

        <div className="p-6 sm:p-8">
          <InsigniaSeccion seccion={libro.seccion} color={libro.color_hex} detalle={libro.genero} />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            {libro.titulo}
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            {libro.autores.map((a) => `${a.nombre} ${a.apellido}${a.pais ? ` (${a.pais})` : ""}`).join(", ")}
          </p>

          {libro.generos_secundarios.length > 0 && (
            <ul aria-label="Otros géneros" className="mt-4 flex flex-wrap gap-2">
              {libro.generos_secundarios.map((g) => (
                <li key={g} className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  {g}
                </li>
              ))}
            </ul>
          )}

          {libro.sinopsis && (
            <p className="mt-6 max-w-prose leading-relaxed text-zinc-700 dark:text-zinc-300">{libro.sinopsis}</p>
          )}

          {/* <dl>: lista de definiciones, la etiqueta semántica para pares "dato: valor". */}
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-4 dark:border-zinc-800">
            <Dato etiqueta="Editorial" valor={libro.editorial} />
            <Dato etiqueta="Año de la edición" valor={libro.anio_publicacion?.toString() ?? "Desconocido"} />
            <Dato etiqueta="Clasificación" valor={libro.clasificacion} />
            <Dato etiqueta="ISBN" valor={libro.isbn} />
          </dl>
        </div>
      </article>

      {/* ¿Dónde está? — el problema del enunciado de Desarrollo de software */}
      <section aria-labelledby="donde-esta" className="mt-10">
        <h2 id="donde-esta" className="text-2xl font-bold tracking-tight">¿Dónde está?</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{resumenDisponibilidad(sedes)}</p>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sedes.map((sede) => (
            <li key={sede.id_sede}>
              <TarjetaSede sede={sede} />
            </li>
          ))}
        </ul>
      </section>

      {/* RN-07, RN-72: reservar. Mostrar el formulario es comodidad; las reglas se comprueban en reservarObra. */}
      <section aria-labelledby="reservar" className="mt-10 max-w-xl rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 id="reservar" className="text-lg font-semibold">Reservar</h2>
        {!usuario ? (
          <p className="mt-2 text-sm">
            <Link href="/login" className="font-medium underline underline-offset-4">Inicia sesión</Link> o{" "}
            <Link href="/registro" className="font-medium underline underline-offset-4">crea una cuenta</Link> para reservar este libro.
          </p>
        ) : !usuario.lector ? (
          <p className="mt-2 text-sm text-zinc-500">Las reservas son para cuentas de lector.</p>
        ) : reservaViva ? (
          <p role="status" className="mt-2 text-sm">
            Tienes este libro reservado en {reservaViva.sede}:{" "}
            {reservaViva.estado === "asignada"
              ? `hay una copia apartada para ti hasta el ${reservaViva.fecha_limite_recogida}.`
              : `estás en el puesto ${reservaViva.posicion} de la cola.`}{" "}
            <Link href="/cuenta" className="font-medium underline underline-offset-4">Ver mis reservas</Link>
          </p>
        ) : !usuario.lector.verificada ? (
          <p className="mt-2 text-sm text-zinc-500">Verifica tu correo para poder reservar.</p>
        ) : (
          <div className="mt-3">
            <FormularioReserva isbn={libro.isbn} sedes={sedes} />
          </div>
        )}
      </section>

      {/* RN-25 a RN-30: solo los títulos con edición PDF (RN-54: la primera versión lee solo PDF). */}
      {digital.tiene_edicion && (
        <SeccionDigital isbn={libro.isbn} disponibilidad={digital} situacion={situacionDigital} conectado={!!usuario}
                        esLector={!!usuario?.lector} verificada={!!usuario?.lector?.verificada} />
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{etiqueta}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{valor}</dd>
    </div>
  );
}

// "3 copias disponibles en 2 de 3 sedes" o un mensaje cuando no hay ninguna.
function resumenDisponibilidad(sedes: DisponibilidadSede[]): string {
  const disponibles = sedes.reduce((suma, sede) => suma + sede.disponibles, 0);
  if (disponibles === 0) return "No hay copias disponibles en este momento en ninguna sede.";
  const sedesConCopias = sedes.filter((sede) => sede.disponibles > 0).length;
  return `${plural(disponibles, "copia disponible", "copias disponibles")} en ${sedesConCopias} de ${plural(sedes.length, "sede", "sedes")}.`;
}
