import type { Metadata } from "next";
import { FormularioLote } from "@/components/panel/formulario-lote";
import { obtenerLicenciasPorTitulo } from "@/lib/data/digital";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Licencias digitales" };

// RN-25, RN-33, RN-54 a RN-56: el administrador de red ve el uso de cada lote y registra lotes nuevos.
export default async function PaginaLicencias() {
  await exigirEmpleado("red");
  const titulos = await obtenerLicenciasPorTitulo();
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Licencias digitales</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Las licencias son de toda la red (RN-25). En uso = préstamos vigentes + reservas asignadas esperando confirmación (RN-56).
        </p>
      </div>

      <section aria-labelledby="titulos" className="space-y-4">
        <h2 id="titulos" className="sr-only">Títulos</h2>
        {titulos.map((t) => {
          const vigentes = t.lotes.filter((l) => l.vigente);
          const total = vigentes.reduce((s, l) => s + l.cantidad, 0);
          const enUso = vigentes.reduce((s, l) => s + l.en_uso, 0);
          return (
            <article key={t.id_libro} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{t.titulo}</h3>
                <p className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
                  {enUso} de {total} en uso{t.en_cola > 0 && ` · ${t.en_cola} en cola`}
                </p>
              </div>
              {/* overflow-x-auto: en móvil la tabla se desplaza dentro de su caja, no la página */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr><th className="py-1 pr-4 font-medium">Lote</th><th className="pr-4 font-medium">Licencias</th><th className="pr-4 font-medium">En uso</th><th className="pr-4 font-medium">Adquirido</th><th className="font-medium">Vence</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {t.lotes.length === 0 && <tr><td colSpan={5} className="py-1 text-zinc-500">Sin lotes.</td></tr>}
                    {t.lotes.map((l) => (
                      <tr key={l.id_licencia} className={l.vigente ? "" : "text-zinc-400 line-through"}>
                        <td className="py-1 pr-4">#{l.id_licencia}</td>
                        <td className="pr-4">{l.cantidad}</td>
                        <td className="pr-4">{l.vigente ? l.en_uso : "—"}</td>
                        <td className="pr-4">{l.adquirido}</td>
                        <td>{l.vence ?? "No vence"}{!l.vigente && " (vencido)"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="nuevo-lote" className="max-w-xl rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 id="nuevo-lote" className="mb-3 text-lg font-semibold">Registrar un lote</h2>
        <FormularioLote titulos={titulos.map((t) => ({ isbn: t.isbn, titulo: t.titulo }))} hoy={hoy} />
      </section>
    </div>
  );
}
