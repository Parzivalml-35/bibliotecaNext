"use client"; // Los error boundaries deben ser Client Components: reaccionan a un error y a un clic.

import { useEffect } from "react";

type ErrorProps = {
  error: Error & { digest?: string };
  retry: () => void; // Next 16: vuelve a pedir los datos y renderizar (reset() no vuelve a pedirlos)
};

// Se muestra si una página o su consulta falla (por ejemplo, MySQL no responde).
// No se muestra error.message: en producción Next lo reemplaza por un texto genérico para no filtrar
// detalles del servidor; el digest sirve para encontrar el error real en los logs.
export default function ErrorDePagina({ error, retry }: ErrorProps) {
  useEffect(() => {
    console.error(error); // en el navegador; el detalle completo queda en la terminal de `pnpm dev`
  }, [error]);

  return (
    <div role="alert" className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">No pudimos cargar esta página</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Puede ser un problema momentáneo con el servidor. Intenta de nuevo en unos segundos.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-500">Código de referencia: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white shadow-sm hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
