import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { ListaMultas } from "@/components/resumen-lector";
import { pagarMultaEnLinea } from "@/lib/actions/multas";
import { obtenerMultasDeLector } from "@/lib/data/lectores";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Multas" };

// Pestaña "Multas" (DI-10): multas y pago en línea (RN-66).
export default async function PaginaMultas() {
  const lector = await exigirLector("/cuenta/multas"); // RN-83
  const multas = await obtenerMultasDeLector(lector.idLector);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Multas</h1>
      <ListaMultas
        multas={multas}
        acciones={(m) =>
          m.pago_en_linea_pendiente ? (
            <Link href={`/cuenta/pago/${m.pago_en_linea_pendiente}`} className="text-xs font-medium underline underline-offset-4">
              Continuar el pago
            </Link>
          ) : (
            <BotonAccion accion={pagarMultaEnLinea} campos={{ id_multa: m.id_multa }} etiqueta="Pagar en línea"
                         etiquetaPendiente="Abriendo pasarela…" variante="principal" />
          )
        }
      />
      <p className="mt-8 text-xs text-zinc-500">También puedes pagar tus multas en efectivo en el mostrador de cualquier sede.</p>
    </>
  );
}
