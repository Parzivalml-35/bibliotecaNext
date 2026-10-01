import Form from "next/form";
import type { Seccion } from "@/lib/definitions";

type BuscadorCatalogoProps = {
  texto: string; // valores actuales de la URL, para que el formulario los muestre
  seccion: string;
  secciones: Seccion[];
};

// Formulario GET: al enviarlo, el navegador arma la URL /?q=...&seccion=... con los `name` de los campos.
// next/form navega sin recargar la página; sin JavaScript, funciona como un <form> normal.
export function BuscadorCatalogo({ texto, seccion, secciones }: BuscadorCatalogoProps) {
  const campo =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    // key: defaultValue solo se aplica al montar el formulario. Si la URL cambia (por ejemplo, con
    // "Limpiar filtros"), una key distinta obliga a React a montarlo de nuevo con los valores nuevos.
    <Form key={`${texto}|${seccion}`} action="/" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="q" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Buscar
        </label>
        <input id="q" name="q" type="search" defaultValue={texto} placeholder="Título o autor" maxLength={100} className={campo} />
      </div>

      <div className="sm:w-56">
        <label htmlFor="seccion" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sección
        </label>
        <select id="seccion" name="seccion" defaultValue={seccion} className={campo}>
          <option value="">Todas</option>
          {secciones.map((s) => (
            <option key={s.nombre} value={s.nombre}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white shadow-sm hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Buscar
      </button>
    </Form>
  );
}
