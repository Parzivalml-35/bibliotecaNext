import { TarjetaLibro } from "@/components/tarjeta-libro";
import { obtenerLibros } from "@/lib/data/libros";

// Server Component (por defecto en app/): se ejecuta en el servidor en cada petición.
// Por eso puede ser async y pedir los datos directamente a la capa lib/data.
export default async function Home() {
  const libros = await obtenerLibros();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Catálogo</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{libros.length} títulos en la red de bibliotecas</p>
      </div>

      {/* Mobile first: 1 columna; desde sm (640px) 2; desde lg (1024px) 3. */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {libros.map((libro) => (
          <li key={libro.id_libro}>
            <TarjetaLibro libro={libro} />
          </li>
        ))}
      </ul>
    </div>
  );
}
