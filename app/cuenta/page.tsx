import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { ResumenDeLector } from "@/components/resumen-lector";
import { cancelarReservaDigitalPropia, devolverDigital, prestarDigital } from "@/lib/actions/digital";
import { pagarMultaEnLinea } from "@/lib/actions/multas";
import { cancelarMiReserva } from "@/lib/actions/reservas";
import { obtenerMultasDeLector, obtenerPrestamosDeLector, obtenerReservasDeLector, obtenerResumenLector } from "@/lib/data/lectores";
import { obtenerDigitalDelLector } from "@/lib/data/digital";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function PaginaCuenta() {
  // El lector sale de la sesión, nunca de la URL: /cuenta no recibe ningún id.
  const lector = await exigirLector();
  const [resumen, prestamos, multas, reservas, digital] = await Promise.all([
    obtenerResumenLector(lector.idLector),
    obtenerPrestamosDeLector(lector.idLector),
    obtenerMultasDeLector(lector.idLector),
    obtenerReservasDeLector(lector.idLector),
    obtenerDigitalDelLector(lector.idLector),
  ]);
  if (!resumen) return null; // la cuenta se desactivó entre la sesión y la consulta

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">{resumen.nombre} · {resumen.correo}</p>
      <ResumenDeLector
        resumen={resumen}
        prestamos={prestamos}
        multas={multas}
        reservas={reservas}
        accionesMulta={(m) =>
          m.pago_en_linea_pendiente ? (
            <Link href={`/cuenta/pago/${m.pago_en_linea_pendiente}`} className="text-xs font-medium underline underline-offset-4">
              Continuar el pago
            </Link>
          ) : (
            <BotonAccion accion={pagarMultaEnLinea} campos={{ id_multa: m.id_multa }} etiqueta="Pagar en línea"
                         etiquetaPendiente="Abriendo pasarela…" variante="principal" />
          )
        }
        accionesReserva={(r) => (
          <BotonAccion accion={cancelarMiReserva} campos={{ id_reserva: r.id_reserva }} etiqueta="Cancelar"
                       etiquetaPendiente="Cancelando…" variante="peligro" />
        )}
      />

      {/* RN-25 a RN-30. Cada botón es su propio formulario; la acción comprueba dueño y título en el servidor. */}
      <section aria-labelledby="digital-titulo" className="mt-8">
        <h2 id="digital-titulo" className="text-lg font-semibold">Libros digitales</h2>
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
      </section>

      <p className="mt-8 text-xs text-zinc-500">También puedes pagar tus multas en efectivo en el mostrador de cualquier sede.</p>
    </div>
  );
}
