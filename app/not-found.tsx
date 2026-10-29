import Link from "next/link";

// Se muestra cuando una página llama a notFound() (por ejemplo, un ISBN que no está en el catálogo).
export default function NoEncontrado() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">No encontramos lo que buscas</h1>
      <p className="mt-2 text-muted-foreground">El libro o la página no existe en el catálogo.</p>
      <Link href="/" className="mt-6 inline-block font-medium underline underline-offset-4">
        Volver al catálogo
      </Link>
    </div>
  );
}
