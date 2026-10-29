import type { ReactNode } from "react";
import Link from "next/link";
import { EstadoVacio } from "@/components/estado-vacio";
import { EtiquetaPrestamo } from "@/components/etiqueta-prestamo";
import { Badge } from "@/components/ui/badge";
import type { MultaDeLector, PrestamoDeLector, ReservaDeLector, ResumenLector } from "@/lib/data/lectores";
import { fechaCorta, pesos, plural } from "@/lib/formato";

// La situación de un lector: la ve él en "Mi cuenta" y la ve el empleado en mostrador. Server Components.
// Las acciones (pagar en línea, cobrar, anular, cancelar) cambian según quién mira: cada página las pasa
// como funciones que devuelven el botón para cada fila. Las funciones se ejecutan aquí, en el servidor.
// Las piezas se exportan por separado para las pestañas de "Mi cuenta" (DI-10); el panel usa ResumenDeLector,
// que las junta. Las listas no llevan título: lo pone quien las usa (un <h2> aquí, el <h1> de la pestaña allá).
// `accionVacia`: qué hacer cuando la lista está vacía (el lector la recibe; el empleado no).

const NOMBRE_ESTADO_CUENTA = {
  registrada: "Registrada: falta verificar el correo",
  verificada: "Verificada: falta validar el documento en una sede para llevarse libros",
  validada: "Validada",
  desactivada: "Desactivada",
};

// DI-09: pendiente = warning (todavía se puede pagar), pagada = success, anulada = gris.
const VARIANTE_MULTA = { pendiente: "warning", pagada: "success", anulada: "secondary" } as const;

const lista = "mt-2 divide-y divide-border rounded-2xl border border-border bg-card text-sm";

export function EstadoLector({ resumen }: { resumen: ResumenLector }) {
  // RN-03, RN-43: el bloqueo se calcula y se explica (no solo "bloqueado").
  const motivos = [
    resumen.prestamos_vencidos > 0 && plural(resumen.prestamos_vencidos, "préstamo vencido", "préstamos vencidos"),
    resumen.multas_pendientes > 0 && `${plural(resumen.multas_pendientes, "multa pendiente", "multas pendientes")} (${pesos(resumen.monto_pendiente)})`,
  ].filter(Boolean);

  return (
    <section aria-labelledby="estado-titulo" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="estado-titulo" className="sr-only">Estado de la cuenta</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Cuenta</dt><dd>{NOMBRE_ESTADO_CUENTA[resumen.estado_cuenta]}</dd></div>
        <div><dt className="text-muted-foreground">Tipo de lector</dt><dd>{resumen.tipo_lector}</dd></div>
        <div>
          <dt className="text-muted-foreground">Préstamos y reservas</dt>
          {/* whitespace-normal: el motivo del bloqueo puede ser largo; el Badge por defecto no parte la línea. */}
          <dd className="mt-0.5">
            {motivos.length > 0
              ? <Badge variant="danger" className="h-auto whitespace-normal">Bloqueado: {motivos.join(" y ")}</Badge>
              : <Badge variant="success">Sin bloqueos</Badge>}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ListaPrestamos({ prestamos, accionVacia }: { prestamos: PrestamoDeLector[]; accionVacia?: ReactNode }) {
  if (prestamos.length === 0) return <EstadoVacio accion={accionVacia}>Sin préstamos abiertos.</EstadoVacio>;
  return (
    <ul className={lista}>
      {prestamos.map((p) => (
        <li key={p.id_prestamo} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <div className="font-medium">{p.titulo}</div>
            <div className="text-xs text-muted-foreground">{p.codigo_barras} · {p.sede} · vence el {fechaCorta(p.fecha_vencimiento)}</div>
          </div>
          <EtiquetaPrestamo prestamo={p} />
        </li>
      ))}
    </ul>
  );
}

export function ListaMultas({ multas, acciones }: { multas: MultaDeLector[]; acciones?: (multa: MultaDeLector) => ReactNode }) {
  if (multas.length === 0) return <EstadoVacio>Sin multas.</EstadoVacio>;
  return (
    <ul className={lista}>
      {multas.map((m) => (
        <li key={m.id_multa} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
          <div>
            <div className="font-medium">{pesos(m.monto)} · {m.tipo === "retraso" ? "Retraso" : "Reposición"}</div>
            <div className="text-xs text-muted-foreground">«{m.titulo}» · {fechaCorta(m.fecha_generada)}</div>
            {m.motivo_anulacion && <div className="text-xs text-muted-foreground">Anulada: {m.motivo_anulacion}</div>}
          </div>
          {m.estado === "pendiente" && acciones
            ? <div className="flex flex-wrap items-start gap-2">{acciones(m)}</div>
            : <Badge variant={VARIANTE_MULTA[m.estado]}>{m.estado}</Badge>}
        </li>
      ))}
    </ul>
  );
}

export function ListaReservas({ reservas, acciones, accionVacia }: {
  reservas: ReservaDeLector[];
  acciones?: (reserva: ReservaDeLector) => ReactNode;
  accionVacia?: ReactNode;
}) {
  if (reservas.length === 0) return <EstadoVacio accion={accionVacia}>Sin reservas.</EstadoVacio>;
  return (
    <ul className={lista}>
      {reservas.map((r) => (
        <li key={r.id_reserva} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
          <div>
            <Link href={`/libros/${r.isbn}`} className="font-medium hover:underline">{r.titulo}</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {r.sede}
              {/* DI-09: info = reserva lista para retirar; warning = en espera. */}
              {r.estado === "asignada"
                ? <Badge variant="info">Lista para recoger hasta el {r.fecha_limite_recogida}</Badge>
                : <Badge variant="warning">Puesto {r.posicion} en la cola</Badge>}
            </div>
          </div>
          {acciones?.(r)}
        </li>
      ))}
    </ul>
  );
}

// Todo junto, para el mostrador (/panel/lectores).
export function ResumenDeLector({
  resumen,
  prestamos,
  multas,
  reservas,
  accionesMulta,
  accionesReserva,
}: {
  resumen: ResumenLector;
  prestamos: PrestamoDeLector[];
  multas: MultaDeLector[];
  reservas: ReservaDeLector[];
  accionesMulta?: (multa: MultaDeLector) => ReactNode;
  accionesReserva?: (reserva: ReservaDeLector) => ReactNode;
}) {
  return (
    <div className="space-y-8">
      <EstadoLector resumen={resumen} />

      <section aria-labelledby="prestamos-titulo">
        <h2 id="prestamos-titulo" className="text-lg font-semibold">Préstamos</h2>
        <ListaPrestamos prestamos={prestamos} />
      </section>

      <section aria-labelledby="multas-titulo">
        <h2 id="multas-titulo" className="text-lg font-semibold">Multas</h2>
        <ListaMultas multas={multas} acciones={accionesMulta} />
      </section>

      <section aria-labelledby="reservas-titulo">
        <h2 id="reservas-titulo" className="text-lg font-semibold">Reservas</h2>
        <ListaReservas reservas={reservas} acciones={accionesReserva} />
      </section>
    </div>
  );
}
