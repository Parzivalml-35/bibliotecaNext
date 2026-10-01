// Esqueletos de carga: bloques grises con la forma aproximada del contenido que viene.
// animate-pulse los hace "latir"; el texto sr-only lo anuncia a lectores de pantalla.

function Bloque({ className }: { className: string }) {
  return <div className={`rounded bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export function EsqueletoCatalogo() {
  return (
    <div role="status" className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <span className="sr-only">Cargando catálogo…</span>
      <Bloque className="h-9 w-48" />
      <Bloque className="mt-3 h-5 w-72" />
      <Bloque className="mt-6 mb-8 h-11 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Array.from crea 6 posiciones para dibujar 6 tarjetas de relleno. */}
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-36 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <Bloque className="h-5 w-3/4" />
            <Bloque className="mt-2 h-4 w-1/2" />
            <Bloque className="mt-10 h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoLibro() {
  return (
    <div role="status" className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      <span className="sr-only">Cargando libro…</span>
      <Bloque className="h-4 w-36" />
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <Bloque className="h-4 w-40" />
        <Bloque className="mt-4 h-10 w-2/3" />
        <Bloque className="mt-3 h-6 w-1/3" />
        <Bloque className="mt-8 h-16 w-full" />
      </div>
      <Bloque className="mt-10 h-8 w-44" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Bloque key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
