import Link from "next/link";

type PaginacionProps = {
  pagina: number;
  totalPaginas: number;
  texto: string; // la búsqueda actual: cada enlace de página la conserva
  seccion: string;
};

// Server Component: solo enlaces, sin estado ni JavaScript. Cada página es una URL que se puede compartir.
export function Paginacion({ pagina, totalPaginas, texto, seccion }: PaginacionProps) {
  if (totalPaginas <= 1) return null; // con una sola página no hay nada que paginar

  // La página 1 no lleva ?pagina=1: así "/" y "/?pagina=1" no son dos URLs distintas para lo mismo.
  function hrefDePagina(numero: number): string {
    const parametros = new URLSearchParams();
    if (texto) parametros.set("q", texto);
    if (seccion) parametros.set("seccion", seccion);
    if (numero > 1) parametros.set("pagina", String(numero));
    const query = parametros.toString();
    return query ? `/?${query}` : "/";
  }

  const numeros = Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const base = "inline-flex min-w-10 items-center justify-center rounded-md px-3 py-2 text-sm font-medium";
  const enlace = `${base} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800`;
  const inactivo = `${base} border border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600`;

  return (
    <nav aria-label="Paginación del catálogo" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {pagina > 1 ? (
        <Link href={hrefDePagina(pagina - 1)} className={enlace}>
          ← Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className={inactivo}>← Anterior</span>
      )}

      <ul className="flex flex-wrap gap-2">
        {numeros.map((numero) => (
          <li key={numero}>
            {numero === pagina ? (
              // aria-current="page": el lector de pantalla anuncia "página actual"
              <span aria-current="page" className={`${base} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`}>
                {numero}
              </span>
            ) : (
              <Link href={hrefDePagina(numero)} aria-label={`Página ${numero}`} className={enlace}>
                {numero}
              </Link>
            )}
          </li>
        ))}
      </ul>

      {pagina < totalPaginas ? (
        <Link href={hrefDePagina(pagina + 1)} className={enlace}>
          Siguiente →
        </Link>
      ) : (
        <span aria-disabled="true" className={inactivo}>Siguiente →</span>
      )}
    </nav>
  );
}
