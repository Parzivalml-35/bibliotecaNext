import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { cancelarReservaDigitalPropia, devolverDigital, prestarDigital, reservarDigital } from "@/lib/actions/digital";
import type { DisponibilidadDigital, SituacionDigitalEnTitulo } from "@/lib/data/digital";

// Sección "Leer en línea" de la página del libro (RN-25 a RN-30). Server Component: decide qué botón mostrar
// con datos leídos sin candado; la acción vuelve a comprobarlo todo con candado. Mostrar u ocultar un botón es
// comodidad, no seguridad (RN-35).
export function SeccionDigital({
  isbn,
  disponibilidad,
  situacion,
  conectado,
  esLector,
  verificada,
}: {
  isbn: string;
  disponibilidad: DisponibilidadDigital;
  situacion: SituacionDigitalEnTitulo | null; // null si no hay lector conectado
  conectado: boolean;
  esLector: boolean;
  verificada: boolean;
}) {
  const { licencias, libres, en_cola } = disponibilidad;
  const resumen = licencias === 0
    ? "Sin licencias vigentes por ahora."
    : `${libres} de ${licencias} licencias libres${en_cola > 0 ? ` · ${en_cola} en cola` : ""}.`;

  let contenido: React.ReactNode;
  if (!conectado) {
    contenido = (
      <p className="text-sm">
        <Link href="/login" className="font-medium underline underline-offset-4">Inicia sesión</Link> para leerlo en línea.
      </p>
    );
  } else if (!esLector || !situacion) {
    contenido = <p className="text-sm text-zinc-500">La lectura en línea es para cuentas de lector.</p>;
  } else if (situacion.compra || situacion.id_prestamo_digital !== null) {
    // RN-29, RN-30: ya tiene acceso.
    contenido = (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p role="status" className="text-sm">
          {situacion.compra ? "Lo compraste: puedes leerlo cuando quieras." : `Lo tienes prestado hasta el ${situacion.fin_prestamo}.`}
        </p>
        <div className="flex items-start gap-2">
          <Link href={`/leer/${isbn}`} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
            Leer ahora
          </Link>
          {situacion.id_prestamo_digital !== null && (
            <BotonAccion accion={devolverDigital} campos={{ id_prestamo_digital: situacion.id_prestamo_digital, isbn }}
                         etiqueta="Devolver" etiquetaPendiente="Devolviendo…" />
          )}
        </div>
      </div>
    );
  } else if (situacion.estado_reserva === "asignada") {
    // RN-28: se le asignó una licencia y tiene un plazo para confirmarla.
    contenido = (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p role="status" className="text-sm">Se liberó una licencia para ti: confírmala antes del {situacion.limite_confirmacion}.</p>
        <div className="flex items-start gap-2">
          <BotonAccion accion={prestarDigital} campos={{ isbn }} etiqueta="Confirmar préstamo" etiquetaPendiente="Confirmando…" variante="principal" />
          <BotonAccion accion={cancelarReservaDigitalPropia} campos={{ id_reserva_digital: situacion.id_reserva_digital!, isbn }}
                       etiqueta="No la quiero" etiquetaPendiente="Cancelando…" variante="peligro" />
        </div>
      </div>
    );
  } else if (situacion.estado_reserva === "activa") {
    // Decisión de la Fase 5: la cola solo avanza con acciones. Si es el primero y hay una licencia libre que
    // nadie asignó todavía (venció un préstamo solo), se le ofrece tomarla; la acción procesa la cola y lo comprueba.
    const leToca = situacion.puesto === 1 && libres > 0;
    contenido = (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p role="status" className="text-sm">
          {leToca ? "Es tu turno: hay una licencia libre." : `Estás en el puesto ${situacion.puesto} de la cola. Te avisamos por correo.`}
        </p>
        <div className="flex items-start gap-2">
          {leToca && <BotonAccion accion={prestarDigital} campos={{ isbn }} etiqueta="Tomar el préstamo" etiquetaPendiente="Prestando…" variante="principal" />}
          <BotonAccion accion={cancelarReservaDigitalPropia} campos={{ id_reserva_digital: situacion.id_reserva_digital!, isbn }}
                       etiqueta="Cancelar reserva" etiquetaPendiente="Cancelando…" variante="peligro" />
        </div>
      </div>
    );
  } else if (!verificada) {
    contenido = <p className="text-sm text-zinc-500">Verifica tu correo para leer libros digitales.</p>;
  } else if (licencias === 0) {
    contenido = null;
  } else if (libres > 0 && en_cola === 0) {
    // Decisión 4a: con licencia libre se presta al instante; reservar solo cuando no queda ninguna.
    contenido = <BotonAccion accion={prestarDigital} campos={{ isbn }} etiqueta="Pedir prestado y leer" etiquetaPendiente="Prestando…" variante="principal" />;
  } else {
    contenido = <BotonAccion accion={reservarDigital} campos={{ isbn }} etiqueta="Reservar (entrar a la cola)" etiquetaPendiente="Reservando…" variante="principal" />;
  }

  return (
    <section aria-labelledby="leer-en-linea" className="mt-10 max-w-xl rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 id="leer-en-linea" className="text-lg font-semibold">Leer en línea</h2>
      <p className="mt-1 mb-3 text-sm text-zinc-600 dark:text-zinc-400">{resumen}</p>
      {contenido}
    </section>
  );
}
