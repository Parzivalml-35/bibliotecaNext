import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { ListaPrestamos, ListaReservas } from "@/components/resumen-lector";
import { buttonVariants } from "@/components/ui/button";
import { cancelarMiReserva } from "@/lib/actions/reservas";
import { obtenerPrestamosDeLector, obtenerReservasDeLector } from "@/lib/data/lectores";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Préstamos y reservas" };

// Pestaña "Préstamos y reservas" (DI-10): lo físico. Lo digital va en /cuenta/digitales.
export default async function PaginaPrestamos() {
  const lector = await exigirLector("/cuenta/prestamos"); // RN-83
  const [prestamos, reservas] = await Promise.all([
    obtenerPrestamosDeLector(lector.idLector),
    obtenerReservasDeLector(lector.idLector),
  ]);

  // La acción siguiente de los estados vacíos ("Estados comunes" de docs/diseno.md).
  const buscarUnLibro = <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>Buscar un libro</Link>;

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Préstamos y reservas</h1>
      <div className="space-y-8">
        <section aria-labelledby="prestamos-titulo">
          <h2 id="prestamos-titulo" className="text-lg font-semibold">Préstamos</h2>
          <ListaPrestamos prestamos={prestamos} accionVacia={buscarUnLibro} />
        </section>

        <section aria-labelledby="reservas-titulo">
          <h2 id="reservas-titulo" className="text-lg font-semibold">Reservas</h2>
          {/* La acción comprueba en el servidor que la reserva sea de quien la cancela. */}
          <ListaReservas
            reservas={reservas}
            accionVacia={buscarUnLibro}
            acciones={(r) => (
              <BotonAccion accion={cancelarMiReserva} campos={{ id_reserva: r.id_reserva }} etiqueta="Cancelar"
                           etiquetaPendiente="Cancelando…" variante="peligro" />
            )}
          />
        </section>
      </div>
    </>
  );
}
