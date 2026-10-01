import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { obtenerDisponibilidadPorSede, obtenerLibroPorIsbn } from "@/lib/data/libros";
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
  const sedes = await obtenerDisponibilidadPorSede(libro.id_libro);

  // Parte A, primera mitad: solo los datos, sin diseño. El diseño con Tailwind viene en la segunda mitad.
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1>{libro.titulo}</h1>
      <p>
        {libro.autores.map((a) => `${a.nombre} ${a.apellido}${a.pais ? ` (${a.pais})` : ""}`).join(", ")}
      </p>
      <p>
        {libro.editorial} · {libro.anio_publicacion ?? "año desconocido"} · {libro.clasificacion} · ISBN {libro.isbn}
      </p>
      <p>
        Sección {libro.seccion} ({libro.color_hex}) · Género {libro.genero}
        {libro.generos_secundarios.length > 0 && ` · También: ${libro.generos_secundarios.join(", ")}`}
      </p>

      <h2>¿Dónde está?</h2>
      <ul>
        {sedes.map((sede) => (
          <li key={sede.id_sede}>
            {sede.sede}: {sede.disponibles} de {sede.total} disponibles
            <ul>
              {sede.ubicaciones.map((u) => (
                <li key={`${u.pasillo}-${u.estante}-${u.nivel}`}>
                  {u.seccion} – Pasillo {u.pasillo} – Estante {u.estante}, nivel {u.nivel} · {u.copias} copia(s)
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
