import { obtenerLibros } from "@/lib/data/libros";

// Server Component (por defecto en app/): se ejecuta en el servidor en cada petición.
// Por eso puede ser async y pedir los datos directamente a la capa lib/data.
export default async function Home() {
  const libros = await obtenerLibros();

  return (
    <main>
      <h1>Catálogo</h1>
      <p>{libros.length} libros</p>
      <ul>
        {libros.map((libro) => (
          <li key={libro.id_libro}>
            {libro.titulo} — {libro.autores} · {libro.seccion} · {libro.disponibles} disponibles
          </li>
        ))}
      </ul>
    </main>
  );
}
