import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { cancelarReservaDigitalPropia, devolverDigital, prestarDigital } from "@/lib/actions/digital";
import { obtenerDigitalDelLector } from "@/lib/data/digital";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Libros digitales" };

// Pestaña "Digitales" (DI-10). RN-25 a RN-30. Cada botón es su propio formulario; la acción comprueba dueño y
// título en el servidor.
export default async function PaginaDigitales() {
  const lector = await exigirLector("/cuenta/digitales"); // RN-83
  const digital = await obtenerDigitalDelLector(lector.idLector);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Libros digitales</h1>
      {digital.prestamos.length === 0 && digital.reservas.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Sin préstamos ni reservas digitales.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {digital.prestamos.map((p) => (
            <li key={`p${p.id_prestamo_digital}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium">{p.titulo}</div>
                <div className="text-xs text-zinc-500">Préstamo digital · termina solo el {p.fin}</div>
              </div>
              <div className="flex items-start gap-2">
                <Link href={`/leer/${p.isbn}`} className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                  Leer
                </Link>
                <BotonAccion accion={devolverDigital} campos={{ id_prestamo_digital: p.id_prestamo_digital, isbn: p.isbn }}
                             etiqueta="Devolver" etiquetaPendiente="Devolviendo…" />
              </div>
            </li>
          ))}
          {digital.reservas.map((r) => (
            <li key={`r${r.id_reserva_digital}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium">{r.titulo}</div>
                <div className="text-xs text-zinc-500">
                  {r.estado === "asignada"
                    ? `Reserva digital · licencia para ti: confírmala antes del ${r.limite_confirmacion}`
                    : `Reserva digital · puesto ${r.puesto} de la cola`}
                </div>
              </div>
              <div className="flex items-start gap-2">
                {r.estado === "asignada" && (
                  <BotonAccion accion={prestarDigital} campos={{ isbn: r.isbn }} etiqueta="Confirmar préstamo"
                               etiquetaPendiente="Confirmando…" variante="principal" />
                )}
                <BotonAccion accion={cancelarReservaDigitalPropia} campos={{ id_reserva_digital: r.id_reserva_digital, isbn: r.isbn }}
                             etiqueta="Cancelar" etiquetaPendiente="Cancelando…" variante="peligro" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
