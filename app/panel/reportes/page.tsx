import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { obtenerIncoherencias, obtenerIndicadores, obtenerTrasladosSugeridos } from "@/lib/data/tablero";
import { pesos } from "@/lib/formato";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Tablero" };

// RN-33: reportes para el coordinador (su sede) y el administrador de red (toda la red).
export default async function PaginaTablero() {
  const empleado = await exigirEmpleado("reportes", "/panel/reportes");
  const idSede = empleado.idSede; // null para admin_red = toda la red
  const [ind, incoherencias, traslados] = await Promise.all([
    obtenerIndicadores(idSede),
    obtenerIncoherencias(idSede),
    obtenerTrasladosSugeridos(idSede),
  ]);

  const tarjetas = [
    { etiqueta: "Préstamos abiertos", valor: ind.prestamos_abiertos },
    { etiqueta: "Préstamos vencidos", valor: ind.prestamos_vencidos, alerta: ind.prestamos_vencidos > 0 },
    { etiqueta: "Multas pendientes", valor: ind.multas_pendientes, detalle: pesos(ind.monto_multas_pendientes) },
    { etiqueta: "Reservas en cola", valor: ind.reservas_en_cola },
    { etiqueta: "Listas para recoger", valor: ind.reservas_asignadas },
    { etiqueta: "Por ubicar", valor: ind.por_ubicar, alerta: ind.por_ubicar > 0 },
    { etiqueta: "Candidatos a perdido", valor: ind.candidatos_perdido, alerta: ind.candidatos_perdido > 0 },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tablero</h1>
        <p className="mt-1 text-sm text-muted-foreground">{empleado.sede ?? "Toda la red"}</p>
        {/* Grilla de indicadores: 2 columnas en móvil, 4 desde lg */}
        <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tarjetas.map((t) => (
            <div key={t.etiqueta} className={cn("rounded-2xl border bg-card p-4", t.alerta ? "border-warning" : "border-border")}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t.etiqueta}</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{t.valor}</dd>
              {t.detalle && <dd className="text-sm text-muted-foreground">{t.detalle}</dd>}
            </div>
          ))}
        </dl>
      </div>

      <section aria-labelledby="traslados">
        <h2 id="traslados" className="text-lg font-semibold">Traslados sugeridos (RN-14)</h2>
        <p className="mb-3 text-sm text-muted-foreground">Sedes con lectores en cola y sin copias, frente a sedes con copias de sobra. Solo sugerencias: ningún libro se mueve solo.</p>
        {traslados.length === 0 ? <p className="text-sm text-muted-foreground">Ninguno.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card text-sm">
            {traslados.map((t, i) => (
              <li key={i} className="px-4 py-3">
                <span className="font-medium">{t.titulo}</span>: {t.sugeridos} de {t.desde} a {t.hacia} ({t.en_cola} en cola)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="detector">
        <h2 id="detector" className="text-lg font-semibold">Coherencia del estado de los ejemplares (RN-24)</h2>
        <p className="mb-3 text-sm text-muted-foreground">Compara el estado guardado de cada ejemplar con el que se deduce de préstamos, reservas y traslados. Debe estar vacío.</p>
        {incoherencias.length === 0 ? (
          <p role="status"><Badge variant="success">Sin incoherencias</Badge></p>
        ) : (
          <ul role="alert" className="divide-y divide-danger/30 rounded-2xl border border-danger bg-danger-suave text-sm text-danger-texto">
            {incoherencias.map((x) => (
              <li key={x.codigo_barras} className="px-4 py-2 font-mono text-xs">
                {x.codigo_barras} ({x.sede}): guardado «{x.guardado}», debería ser «{x.deducido}»
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
