import type { Metadata } from "next";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { Estrellas } from "@/components/resenas/estrellas";
import { Badge } from "@/components/ui/badge";
import { descartarReportesDeResena, ocultarResenaReportada, volverAMostrarResena } from "@/lib/actions/moderacion";
import { type ResenaAModerar, resenasOcultas, resenasReportadas } from "@/lib/data/resenas";
import { NOMBRE_MOTIVO } from "@/lib/resenas";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Reseñas reportadas" };

// RN-95: la moderación. Arriba, las reseñas publicadas con reportes pendientes (la más reportada primero): ocultarla
// (resuelve todos sus reportes) o descartar los reportes (sigue publicada). Abajo, las ocultas, para volver a
// mostrarlas si fue un error. Permiso `lectores` (todo el personal, RN-33); las acciones lo vuelven a verificar.
// Aquí sí se ve el nombre real junto al apodo (RN-92: el personal lo ve, para auditar).
export default async function PaginaResenasReportadas() {
  await exigirEmpleado("lectores", "/panel/lectores/resenas");
  const [reportadas, ocultas] = await Promise.all([resenasReportadas(), resenasOcultas()]);

  return (
    <div className="space-y-10">
      <section aria-labelledby="reportadas">
        <h1 id="reportadas" className="text-2xl font-bold tracking-tight">Reseñas reportadas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se publican al instante y los lectores las reportan. Oculta las que no cumplan; si el reporte no tiene razón,
          descártalo. Ocultar no borra nada: la reseña deja de verse y de contar en el promedio, y su autor la ve marcada.
        </p>
        {reportadas.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No hay reportes pendientes.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reportadas.map((r) => (
              <li key={r.id_resena}>
                <TarjetaModeracion resena={r}>
                  <div className="mt-3 rounded-xl bg-muted/50 p-3">
                    <h3 className="text-xs font-medium">
                      {r.reportes.length === 1 ? "1 reporte pendiente" : `${r.reportes.length} reportes pendientes`}
                    </h3>
                    <ul className="mt-1 space-y-1 text-xs">
                      {r.reportes.map((rep, i) => (
                        <li key={i}>
                          <span className="font-medium">{NOMBRE_MOTIVO[rep.motivo]}</span>
                          {rep.detalle && <> — «{rep.detalle}»</>}
                          <span className="text-muted-foreground"> · {rep.apodo} · {rep.fecha}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* flex-wrap + justify-end: los dos botones a la derecha; en el celular bajan si no caben. */}
                  <div className="mt-3 flex flex-wrap justify-end gap-3">
                    <BotonAccion accion={descartarReportesDeResena} campos={{ id_resena: r.id_resena }}
                                 etiqueta="Descartar reportes" etiquetaPendiente="Descartando…" />
                    <BotonAccion accion={ocultarResenaReportada} campos={{ id_resena: r.id_resena }}
                                 etiqueta="Ocultar reseña" etiquetaPendiente="Ocultando…" variante="peligro" />
                  </div>
                </TarjetaModeracion>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ocultas">
        <h2 id="ocultas" className="text-lg font-semibold">Reseñas ocultas</h2>
        {ocultas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No hay reseñas ocultas.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {ocultas.map((r) => (
              <li key={r.id_resena}>
                <TarjetaModeracion resena={r}>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Oculta el {r.oculta_el}{r.oculta_por ? ` por ${r.oculta_por}` : ""}.</p>
                    <BotonAccion accion={volverAMostrarResena} campos={{ id_resena: r.id_resena }}
                                 etiqueta="Volver a mostrar" etiquetaPendiente="Publicando…" />
                  </div>
                </TarjetaModeracion>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// La reseña tal como la escribió su autor, con el libro y quién es. `children`: lo que cambia en cada lista.
function TarjetaModeracion({ resena: r, children }: { resena: ResenaAModerar; children: React.ReactNode }) {
  return (
    <article aria-label={`Reseña de ${r.apodo} sobre ${r.titulo}`} className="rounded-2xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/libros/${r.isbn}`} className="font-medium underline-offset-4 hover:underline">{r.titulo}</Link>
        <span className="text-sm">
          {r.apodo} <span className="text-muted-foreground">({r.nombre})</span>
        </span>
        <span className="text-xs text-muted-foreground">{r.fecha}</span>
      </header>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <Estrellas valor={r.estrellas} />
        <Badge variant={r.recomienda ? "success" : "outline"}>{r.recomienda ? "Lo recomienda" : "No lo recomienda"}</Badge>
      </div>
      {/* Texto plano: React escapa el contenido (RN-94); el empleado ve lo mismo que habría visto un lector. */}
      {r.texto ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line break-words">{r.texto}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">(Sin texto: solo la calificación.)</p>
      )}
      {children}
    </article>
  );
}
