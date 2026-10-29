import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { EstadoVacio } from "@/components/estado-vacio";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
        <EstadoVacio accion={<Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>Buscar un libro</Link>}>
          Sin préstamos ni reservas digitales. Los libros con edición digital tienen la sección «Leer en línea».
        </EstadoVacio>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card text-sm">
          {digital.prestamos.map((p) => (
            <li key={`p${p.id_prestamo_digital}`} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium">{p.titulo}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {/* DI-09: info = préstamo digital. */}
                  <Badge variant="info">Préstamo digital</Badge> Termina solo el {p.fin}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Link href={`/leer/${p.isbn}`} className={buttonVariants({ size: "xs" })}>
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
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {/* DI-09: info = lista para tomar; warning = en espera. */}
                  {r.estado === "asignada"
                    ? <><Badge variant="info">Licencia para ti</Badge> Confírmala antes del {r.limite_confirmacion}</>
                    : <><Badge variant="warning">En cola</Badge> Puesto {r.puesto}</>}
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
