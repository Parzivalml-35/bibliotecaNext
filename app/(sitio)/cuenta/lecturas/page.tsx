import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BorrarLectura } from "@/components/cuenta/borrar-lectura";
import { EstadoVacio } from "@/components/estado-vacio";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import {
  type LibroLeido,
  listarAnotacionesDelLector,
  listarLibrosLeidos,
  listarNotasLibresDelLector,
  listarSesionesDelLector,
  type SesionDeLectura,
} from "@/lib/data/lectura";
import { type Anotacion, COLOR_ANOTACION, enOrdenDelLibro, NOMBRE_ESTILO_ANOTACION, type NotaLibre } from "@/lib/lectura";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mis lecturas" };

// Pestaña "Lecturas" de Mi cuenta (R10-F, RN-87, RN-88): por libro, lo que el lector escribió (notas libres y
// fragmentos marcados) y su historial de lectura. SOLO del lector de la sesión: todas las consultas filtran por su
// id_lector (exigirLector), nunca por algo que llegue en la URL. Sin acceso vigente al libro (terminó el préstamo) se
// puede VER y BORRAR, pero no ir al pasaje ni seguir leyendo.

const SESIONES_VISIBLES = 10; // el historial muestra las últimas; el total (cuántas y cuánto tiempo) cuenta todas

export default async function PaginaLecturas() {
  const lector = await exigirLector("/cuenta/lecturas"); // RN-83
  // Las cuatro consultas no dependen una de otra: Promise.all las lanza a la vez.
  const [libros, anotaciones, notas, sesiones] = await Promise.all([
    listarLibrosLeidos(lector.idLector),
    listarAnotacionesDelLector(lector.idLector),
    listarNotasLibresDelLector(lector.idLector),
    listarSesionesDelLector(lector.idLector),
  ]);
  // El acceso de cada libro, con la MISMA función que usa /leer (una sola regla de acceso en el código). Una consulta
  // por libro, en paralelo; un lector tiene pocos libros con lecturas.
  const accesos = await Promise.all(libros.map((l) => obtenerAccesoDeLectura(lector.idLector, l.isbn)));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Mis lecturas</h1>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Tus notas, los fragmentos que marcaste y cuánto leíste en cada libro digital. Solo tú los ves.
      </p>
      {libros.length === 0 ? (
        <EstadoVacio accion={<Link href="/cuenta/digitales" className={buttonVariants({ variant: "outline", size: "sm" })}>Mis libros digitales</Link>}>
          Todavía no hay lecturas. Al leer un libro digital, aquí aparecen tus notas, tus resaltados y tu historial.
        </EstadoVacio>
      ) : (
        <div className="space-y-4">
          {libros.map((libro, i) => (
            <TarjetaLibro key={libro.id_libro} libro={libro} conAcceso={accesos[i] !== null}
                          notas={notas.filter((n) => n.id_libro === libro.id_libro)}
                          resaltados={enOrdenDelLibro(anotaciones.filter((a) => a.id_libro === libro.id_libro))}
                          sesiones={sesiones.filter((s) => s.id_libro === libro.id_libro)} />
          ))}
        </div>
      )}
    </>
  );
}

// "1 h 05 min", "12 min" o "menos de 1 min" (el tiempo de una sesión empieza a contar con el primer aviso, RN-88).
function duracion(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 1) return "menos de 1 min";
  const h = Math.floor(minutos / 60);
  return h > 0 ? `${h} h ${String(minutos % 60).padStart(2, "0")} min` : `${minutos} min`;
}
const porciento = (f: number) => `${Math.round(f * 100)} %`;

function TarjetaLibro({ libro, conAcceso, notas, resaltados, sesiones }: {
  libro: LibroLeido;
  conAcceso: boolean;
  notas: NotaLibre[];
  resaltados: Anotacion[];
  sesiones: SesionDeLectura[];
}) {
  const avance = libro.avance === null ? null : Math.round(libro.avance * 100);
  const total = sesiones.reduce((suma, s) => suma + s.segundos, 0);
  // El enlace al pasaje (RN-87: solo con acceso). <a> y no <Link> (RN-84): a /leer se entra con navegación completa.
  // encodeURIComponent: un CFI lleva "/", "!", "," y ":"; en la URL va codificado y la página lo valida (esCfi).
  const alPasaje = (cfi: string) => `/leer/${libro.isbn}?ir=${encodeURIComponent(cfi)}`;

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">
            <Link href={`/libros/${libro.isbn}`} className="hover:underline">{libro.titulo}</Link>
          </h2>
          {libro.autores && <p className="text-sm text-muted-foreground">{libro.autores}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Última actividad: {libro.ultima}</p>
        </div>
        {conAcceso ? (
          // <a> (RN-84). El visor sigue donde quedó (RN-88).
          <a href={`/leer/${libro.isbn}`} className={buttonVariants({ size: "sm" })}>Seguir leyendo</a>
        ) : (
          // DI-09: warning = algo que limita. El texto dice qué se puede hacer (el color nunca va solo).
          <Badge variant="warning">Sin acceso: puedes ver y borrar</Badge>
        )}
      </div>

      {avance !== null && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>Avance</span>
            <span>{avance} %</span>
          </div>
          {/* La misma barra que el pie del visor. El ancho calculado va en style (Tailwind no genera una clase por valor). */}
          <div role="progressbar" aria-label={`Avance en ${libro.titulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance}
               className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${avance}%` }} />
          </div>
        </div>
      )}

      {/* Las tres secciones, plegables con <details>/<summary>: nativo del navegador, sin JavaScript, accesible con el
          teclado. Empiezan cerradas: con muchos libros, la página se recorre de un vistazo. */}
      <div className="mt-4 space-y-2">
        <Seccion titulo="Notas libres" cuantas={notas.length} vacia="Sin notas libres en este libro.">
          {notas.map((n) => (
            <li key={n.id_nota_libre} className="space-y-1.5 py-3">
              {/* Texto, nunca HTML (RN-87): React lo escapa. whitespace-pre-wrap respeta los saltos de línea. */}
              <p className="text-sm whitespace-pre-wrap break-words">{n.texto}</p>
              <p className="text-xs text-muted-foreground">
                {n.capitulo && <>{n.capitulo} · </>}{n.fecha_creacion}{n.editada ? " · editada" : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {conAcceso && n.cfi && (
                  <a href={alPasaje(n.cfi)} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                    Ir a donde la escribí
                  </a>
                )}
                <BorrarLectura tipo="nota" id={n.id_nota_libre} />
              </div>
            </li>
          ))}
        </Seccion>

        <Seccion titulo="Resaltados" cuantas={resaltados.length} vacia="Sin fragmentos marcados en este libro.">
          {resaltados.map((a) => (
            // border-l-4 con el color de la marca, como en el panel del visor.
            <li key={a.id_anotacion} className="my-2 space-y-1.5 border-l-4 py-1 pl-3" style={{ borderLeftColor: COLOR_ANOTACION[a.color].linea }}>
              <blockquote className="font-heading text-sm leading-relaxed">«{a.texto_citado}»</blockquote>
              {a.nota && <p className="rounded-lg bg-muted px-2.5 py-1.5 text-sm whitespace-pre-wrap break-words">{a.nota}</p>}
              <p className="text-xs text-muted-foreground">
                {COLOR_ANOTACION[a.color].nombre} · {NOMBRE_ESTILO_ANOTACION[a.estilo]} · {a.fecha_creacion}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {conAcceso && (
                  <a href={alPasaje(a.cfi)} className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                    Ir al pasaje
                  </a>
                )}
                <BorrarLectura tipo="resaltado" id={a.id_anotacion} />
              </div>
            </li>
          ))}
        </Seccion>

        <Seccion titulo="Historial" cuantas={sesiones.length} resumen={sesiones.length > 0 ? `${duracion(total)} en total` : undefined}
                 vacia="Sin sesiones de lectura registradas.">
          {sesiones.slice(0, SESIONES_VISIBLES).map((s, i) => (
            // tabular-nums: las cifras ocupan el mismo ancho y las columnas quedan alineadas.
            <li key={i} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm tabular-nums">
              <span>{s.inicio}</span>
              <span className="text-muted-foreground">
                {duracion(s.segundos)} · {s.formato.toUpperCase()} · {porciento(s.progreso_inicial)} → {porciento(s.progreso_final)}
              </span>
            </li>
          ))}
          {sesiones.length > SESIONES_VISIBLES && (
            <li className="py-2 text-xs text-muted-foreground">Se muestran las {SESIONES_VISIBLES} más recientes de {sesiones.length}.</li>
          )}
        </Seccion>
      </div>
    </article>
  );
}

// Una sección plegable. summary: el título, cuántas hay y, opcional, un resumen (el tiempo total del historial).
// Server Component: no necesita estado, el plegado lo hace el navegador.
function Seccion({ titulo, cuantas, resumen, vacia, children }: {
  titulo: string;
  cuantas: number;
  resumen?: string;
  vacia: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border px-3">
      {/* cursor-pointer: el summary es clicable. marker:text-muted-foreground: el triángulo nativo, más suave. */}
      <summary className="cursor-pointer py-2.5 text-sm font-medium marker:text-muted-foreground">
        {titulo} <span className="text-muted-foreground tabular-nums">({cuantas}{resumen ? ` · ${resumen}` : ""})</span>
      </summary>
      {cuantas === 0
        ? <p className="pb-3 text-sm text-muted-foreground">{vacia}</p>
        // divide-y: una línea fina entre elementos (border-top en todos menos el primero).
        : <ul className="divide-y divide-border border-t border-border pb-1">{children}</ul>}
    </details>
  );
}
