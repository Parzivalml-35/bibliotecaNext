import type { ReactNode } from "react";
import Link from "next/link";
import type { MultaDeLector, PrestamoDeLector, ReservaDeLector, ResumenLector } from "@/lib/data/lectores";
import { fechaCorta, pesos, plural } from "@/lib/formato";

// La situación de un lector: la ve él en "Mi cuenta" y la ve el empleado en mostrador. Server Component.
// Las acciones (pagar en línea, cobrar, anular, cancelar) cambian según quién mira: cada página las pasa
// como funciones que devuelven el botón para cada fila. Las funciones se ejecutan aquí, en el servidor.

const NOMBRE_ESTADO_CUENTA = {
  registrada: "Registrada: falta verificar el correo",
  verificada: "Verificada: falta validar el documento en una sede para llevarse libros",
  validada: "Validada",
  desactivada: "Desactivada",
};

const insignia = "rounded-full px-2 py-0.5 text-xs font-medium";
const rojo = `${insignia} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200`;
const verde = `${insignia} bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200`;
const gris = `${insignia} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`;

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
  // RN-03, RN-43: el bloqueo se calcula y se explica (no solo "bloqueado").
  const motivos = [
    resumen.prestamos_vencidos > 0 && plural(resumen.prestamos_vencidos, "préstamo vencido", "préstamos vencidos"),
    resumen.multas_pendientes > 0 && `${plural(resumen.multas_pendientes, "multa pendiente", "multas pendientes")} (${pesos(resumen.monto_pendiente)})`,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <section aria-labelledby="estado-titulo" className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 id="estado-titulo" className="sr-only">Estado de la cuenta</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-zinc-500">Cuenta</dt><dd>{NOMBRE_ESTADO_CUENTA[resumen.estado_cuenta]}</dd></div>
          <div><dt className="text-zinc-500">Tipo de lector</dt><dd>{resumen.tipo_lector}</dd></div>
          <div>
            <dt className="text-zinc-500">Préstamos y reservas</dt>
            <dd>
              {motivos.length > 0
                ? <span className={rojo}>Bloqueado: {motivos.join(" y ")}</span>
                : <span className={verde}>Sin bloqueos</span>}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="prestamos-titulo">
        <h2 id="prestamos-titulo" className="text-lg font-semibold">Préstamos</h2>
        {prestamos.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Sin préstamos abiertos.</p> : (
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {prestamos.map((p) => (
              <li key={p.id_prestamo} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <div className="font-medium">{p.titulo}</div>
                  <div className="text-xs text-zinc-500">{p.codigo_barras} · {p.sede} · vence el {fechaCorta(p.fecha_vencimiento)}</div>
                </div>
                {p.perdido ? <span className={gris}>Declarado perdido</span>
                  : p.dias_atraso > 0 ? <span className={rojo}>Vencido · {plural(p.dias_atraso, "día", "días")}</span>
                  : <span className={verde}>Al día</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="multas-titulo">
        <h2 id="multas-titulo" className="text-lg font-semibold">Multas</h2>
        {multas.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Sin multas.</p> : (
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {multas.map((m) => (
              <li key={m.id_multa} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div>
                  <div className="font-medium">{pesos(m.monto)} · {m.tipo === "retraso" ? "Retraso" : "Reposición"}</div>
                  <div className="text-xs text-zinc-500">«{m.titulo}» · {fechaCorta(m.fecha_generada)}</div>
                  {m.motivo_anulacion && <div className="text-xs text-zinc-500">Anulada: {m.motivo_anulacion}</div>}
                </div>
                {m.estado === "pendiente" && accionesMulta
                  ? <div className="flex flex-wrap items-start gap-2">{accionesMulta(m)}</div>
                  : <span className={m.estado === "pendiente" ? rojo : m.estado === "pagada" ? verde : gris}>{m.estado}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reservas-titulo">
        <h2 id="reservas-titulo" className="text-lg font-semibold">Reservas</h2>
        {reservas.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Sin reservas.</p> : (
          <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {reservas.map((r) => (
              <li key={r.id_reserva} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div>
                  <Link href={`/libros/${r.isbn}`} className="font-medium hover:underline">{r.titulo}</Link>
                  <div className="text-xs text-zinc-500">
                    {r.sede} · {r.estado === "asignada"
                      ? `lista para recoger hasta el ${r.fecha_limite_recogida}`
                      : `puesto ${r.posicion} en la cola`}
                  </div>
                </div>
                {accionesReserva?.(r)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
