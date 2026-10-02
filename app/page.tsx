import Link from "next/link";
import { BuscadorCatalogo } from "@/components/buscador-catalogo";
import { Paginacion } from "@/components/paginacion";
import { TarjetaLibro } from "@/components/tarjeta-libro";
import { obtenerPaginaDeLibros, obtenerSecciones } from "@/lib/data/libros";
import { plural } from "@/lib/formato";

// Un parámetro de la URL puede faltar (undefined), venir una vez (string) o repetido (?q=a&q=b → string[]).
// Esto lo reduce siempre a un texto limpio y acotado.
function textoDeParametro(valor: string | string[] | undefined): string {
  const texto = Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? "");
  return texto.trim().slice(0, 100);
}

// ?pagina=: un entero desde 1. Cualquier otra cosa ("abc", "-3", "2.5") cuenta como la página 1.
function numeroDePagina(valor: string): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

// Server Component (por defecto en app/): se ejecuta en el servidor en cada petición.
// Lee los filtros de la URL; no hay estado en el navegador: la URL ES el estado.
export default async function Home({ searchParams }: PageProps<"/">) {
  const parametros = await searchParams; // como params, searchParams es una Promise
  const texto = textoDeParametro(parametros.q);
  const seccionPedida = textoDeParametro(parametros.seccion);

  // Solo se acepta una sección que exista; cualquier otro valor se ignora (se muestran todas).
  const secciones = await obtenerSecciones();
  const seccion = secciones.some((s) => s.nombre === seccionPedida) ? seccionPedida : "";

  const { libros, total, pagina, totalPaginas, porPagina } = await obtenerPaginaDeLibros(
    { texto, seccion },
    numeroDePagina(textoDeParametro(parametros.pagina)),
  );
  const hayFiltros = texto !== "" || seccion !== "";
  const desde = (pagina - 1) * porPagina + 1; // posición del primer libro de la página, para el texto
  const hasta = desde + libros.length - 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Catálogo</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {hayFiltros
            ? `${plural(total, "resultado", "resultados")}${texto ? ` para «${texto}»` : ""}${seccion ? ` en ${seccion}` : ""}`
            : `${plural(total, "título", "títulos")} en la red de bibliotecas`}
          {totalPaginas > 1 && ` · mostrando ${desde}–${hasta}`}
          {hayFiltros && (
            <>
              {" · "}
              <Link href="/" className="font-medium underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100">
                Limpiar filtros
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="mb-8">
        <BuscadorCatalogo texto={texto} seccion={seccion} secciones={secciones} />
      </div>

      {libros.length > 0 ? (
        // Mobile first: 1 columna; desde sm (640px) 2; desde lg (1024px) 3.
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {libros.map((libro) => (
              <li key={libro.id_libro}>
                <TarjetaLibro libro={libro} />
              </li>
            ))}
          </ul>
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} texto={texto} seccion={seccion} />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="font-medium">No encontramos libros con esa búsqueda.</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Prueba con otro título, otro autor o todas las secciones.</p>
        </div>
      )}
    </div>
  );
}
