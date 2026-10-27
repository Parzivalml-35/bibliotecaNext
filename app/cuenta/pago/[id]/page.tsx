import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonAccion } from "@/components/boton-accion";
import { confirmarPagoSimulado } from "@/lib/actions/multas";
import { obtenerPago } from "@/lib/data/multas";
import { pesos } from "@/lib/formato";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Pasarela de pago (simulada)" };

// D-07: la "pasarela" simulada. Con una real, aquí se redirigiría al sitio del proveedor y la confirmación
// llegaría a un Route Handler (webhook) firmado por él. Los estados (pendiente → pagado/fallido) ya son los reales.
export default async function PaginaPago({ params }: PageProps<"/cuenta/pago/[id]">) {
  const { id } = await params;
  const lector = await exigirLector(`/cuenta/pago/${encodeURIComponent(id)}`); // RN-83
  const idPago = Number(id);
  if (!Number.isInteger(idPago) || idPago <= 0) notFound();

  const pago = await obtenerPago(null, idPago);
  // De otra persona o inexistente: 404 en ambos casos (no se confirma que el pago exista).
  if (!pago || pago.id_cuenta_lector !== lector.idCuenta) notFound();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Pasarela simulada · no se cobra dinero real</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Pagar {pesos(pago.monto)}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Multa de «{pago.titulo}» · pago n.º {pago.id_pago}</p>

      {pago.estado === "pendiente" ? (
        <div className="mt-6 flex gap-3">
          <BotonAccion accion={confirmarPagoSimulado} campos={{ id_pago: pago.id_pago, resultado: "aprobado" }}
                       etiqueta="Simular pago aprobado" etiquetaPendiente="Procesando…" variante="principal" />
          <BotonAccion accion={confirmarPagoSimulado} campos={{ id_pago: pago.id_pago, resultado: "rechazado" }}
                       etiqueta="Simular rechazo" etiquetaPendiente="Procesando…" variante="peligro" />
        </div>
      ) : (
        <p role="status" className="mt-6 text-sm">Este pago está <strong>{pago.estado}</strong>.</p>
      )}
      <p className="mt-8"><Link href="/cuenta" className="text-sm font-medium underline underline-offset-4">Volver a mi cuenta</Link></p>
    </div>
  );
}
