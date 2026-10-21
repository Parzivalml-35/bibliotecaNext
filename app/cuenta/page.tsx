import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { ResumenDeLector } from "@/components/resumen-lector";
import { pagarMultaEnLinea } from "@/lib/actions/multas";
import { cancelarMiReserva } from "@/lib/actions/reservas";
import { obtenerMultasDeLector, obtenerPrestamosDeLector, obtenerReservasDeLector, obtenerResumenLector } from "@/lib/data/lectores";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function PaginaCuenta() {
  // El lector sale de la sesión, nunca de la URL: /cuenta no recibe ningún id.
  const lector = await exigirLector();
  const [resumen, prestamos, multas, reservas] = await Promise.all([
    obtenerResumenLector(lector.idLector),
    obtenerPrestamosDeLector(lector.idLector),
    obtenerMultasDeLector(lector.idLector),
    obtenerReservasDeLector(lector.idLector),
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
      <p className="mt-8 text-xs text-zinc-500">También puedes pagar tus multas en efectivo en el mostrador de cualquier sede.</p>
    </div>
  );
}
