import { CheckmarkBadge01Icon, ThumbsDownIcon, ThumbsUpIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Estrellas } from "@/components/resenas/estrellas";
import { FormularioResena } from "@/components/resenas/formulario-resena";
import { ReportarResena } from "@/components/resenas/reportar-resena";
import { Badge } from "@/components/ui/badge";
import { maxCaracteresResena, miResena, resenasDeLibro, resumenDeResenas } from "@/lib/data/resenas";
import { obtenerUsuario } from "@/lib/sesion";

// RN-94, RN-95: las reseñas en la ficha del libro. Server Component asíncrono: lee el resumen, la lista y, si hay un
// lector conectado, su reseña. Mostrar el formulario o el botón de reportar es comodidad: las acciones vuelven a
// comprobar la sesión, la cuenta verificada y el dueño.
// Lo público lleva el APODO (RN-92): esta sección nunca recibe el nombre del lector.
export async function SeccionResenas({ idLibro, isbn }: { idLibro: number; isbn: string }) {
  const usuario = await obtenerUsuario();
  const lector = usuario?.lector ?? null;
  const [resumen, lista, propia, maximo] = await Promise.all([
    resumenDeResenas(idLibro),
    resenasDeLibro(idLibro, lector?.idLector ?? null),
    lector ? miResena(lector.idLector, idLibro) : null,
    maxCaracteresResena(),
  ]);
  const porcentaje = resumen.cantidad > 0 ? Math.round((resumen.recomiendan / resumen.cantidad) * 100) : 0;

  return (
    // scroll-mt-24: al llegar con #resenas, el título no queda debajo de la barra flotante.
    <section aria-labelledby="resenas" id="seccion-resenas" className="mt-10 scroll-mt-24">
      <h2 id="resenas" className="text-2xl font-bold tracking-tight">Reseñas de lectores</h2>
      {resumen.cantidad === 0 ? (
        <p className="mt-1 text-muted-foreground">Todavía nadie ha reseñado este libro.</p>
      ) : (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <Estrellas valor={resumen.promedio ?? 0} />
          <span className="font-medium text-foreground tabular-nums">
            {(resumen.promedio ?? 0).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span>· {resumen.cantidad} {resumen.cantidad === 1 ? "reseña" : "reseñas"}</span>
          <span>· el {porcentaje} % lo recomienda</span>
        </p>
      )}

      {/* lg:grid-cols-[1fr_22rem]: la lista a la izquierda y el formulario propio a la derecha en pantallas anchas. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ol className="space-y-4 lg:order-first">
          {lista.filter((r) => !r.propia).map((r) => (
            <li key={r.id_resena}>
              <article aria-label={`Reseña de ${r.apodo}`} className="rounded-2xl border border-border bg-card p-4">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{r.apodo}</span>
                  {r.lo_leyo && (
                    // RN-94: la insignia la calcula el servidor (tuvo el libro aquí); nadie la elige.
                    <Badge variant="success" className="gap-1">
                      <HugeiconsIcon icon={CheckmarkBadge01Icon} aria-hidden="true" />
                      Lo leyó en la biblioteca
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{r.fecha}{r.editada ? " · editada" : ""}</span>
                </header>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <Estrellas valor={r.estrellas} />
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <HugeiconsIcon icon={r.recomienda ? ThumbsUpIcon : ThumbsDownIcon} aria-hidden="true" className="size-4" />
                    {r.recomienda ? "Lo recomienda" : "No lo recomienda"}
                  </span>
                </div>
                {/* Texto plano (RN-94): React escapa el contenido; whitespace-pre-line conserva los saltos de línea. */}
                {r.texto && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line break-words">{r.texto}</p>}
                {lector?.verificada && (
                  <div className="mt-2">
                    <ReportarResena idResena={r.id_resena} yaReportada={r.reportada} />
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-border bg-card p-4 lg:self-start">
          <h3 className="mb-3 font-semibold">{propia ? "Tu reseña" : "Escribe una reseña"}</h3>
          {!usuario ? (
            <p className="text-sm">
              {/* RN-83: al entrar, vuelve a esta sección. */}
              <Link href={`/login?siguiente=${encodeURIComponent(`/libros/${isbn}#seccion-resenas`)}`} className="font-medium underline underline-offset-4">
                Inicia sesión
              </Link>{" "}para contar qué te pareció. Se publica con tu apodo, no con tu nombre.
            </p>
          ) : !lector ? (
            <p className="text-sm text-muted-foreground">Las reseñas son para cuentas de lector.</p>
          ) : !lector.verificada ? (
            <p className="text-sm text-muted-foreground">Verifica tu correo para publicar reseñas.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">Se publica con tu apodo, <span className="font-medium">@{usuario.apodo}</span>, no con tu nombre.</p>
              <FormularioResena isbn={isbn} actual={propia} maximo={maximo} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
