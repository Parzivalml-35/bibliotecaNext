"use client";

import { Cancel01Icon, Delete02Icon, HighlighterIcon, Location01Icon, Note01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { compare } from "foliate-js/epubcfi.js";
import { type KeyboardEvent, type Ref, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SheetTitle } from "@/components/ui/sheet";
import { type Anotacion, COLOR_ANOTACION, largo, NOMBRE_ESTILO_ANOTACION, type NotaLibre } from "@/lib/lectura";
import { cn } from "@/lib/utils";

// R10-D, el panel derecho del visor EPUB ("lo mío", decidido con el usuario el 2026-11-11): lo que el lector escribió
// en este libro. Dos pestañas: Notas libres (RN-86: escribir, editar, borrar, ir a donde se escribió) y Resaltados
// (RN-85: la lista en el orden del libro; ir al pasaje, borrar). El mismo panel va fijo a la derecha en el escritorio y
// dentro de un cajón (Sheet) en el celular, como la barra izquierda.
//
// No llama a las Server Actions: recibe funciones del visor (alCrear, alEditar…) que devuelven el error a mostrar o null.
// Así el estado de las notas vive en UN lugar (el visor), y el error se muestra aquí, junto a lo que lo causó (un aviso
// arriba de la pantalla quedaría tapado por el cajón en el celular).

export type PestanaNotas = "notas" | "resaltados";
const PESTANAS: { id: PestanaNotas; nombre: string; icono: typeof Note01Icon }[] = [
  { id: "notas", nombre: "Notas libres", icono: Note01Icon },
  { id: "resaltados", nombre: "Resaltados", icono: HighlighterIcon },
];

type Respuesta = Promise<string | null>; // null = salió bien; texto = el error para el lector

export function PanelNotas({
  pestana, alCambiarPestana, notas, resaltados, maxNota, capituloActual, pedidoNueva,
  alCrear, alEditar, alBorrarNota, alBorrarResaltado, alIr, alCerrar, enCajon = false,
}: {
  pestana: PestanaNotas;
  alCambiarPestana: (p: PestanaNotas) => void;
  notas: NotaLibre[];
  resaltados: Anotacion[];
  maxNota: number;
  capituloActual: string | null;
  pedidoNueva: number; // cambia cada vez que el lápiz pide "Nueva nota libre": el editor toma el foco
  alCrear: (texto: string) => Respuesta;
  alEditar: (id: number, texto: string) => Respuesta;
  alBorrarNota: (id: number) => Respuesta;
  alBorrarResaltado: (id: number) => Respuesta;
  alIr: (cfi: string) => void;
  alCerrar: () => void;
  enCajon?: boolean; // dentro del cajón del celular (un diálogo de Radix)
}) {
  const base = useId(); // ids únicos: el panel puede existir dos veces (fijo y en el cajón), como la barra izquierda

  // Patrón de pestañas de WAI-ARIA (el mismo de la barra izquierda): las flechas se mueven entre pestañas.
  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const otra = pestana === "notas" ? "resaltados" : "notas";
    alCambiarPestana(otra);
    document.getElementById(`${base}-tab-${otra}`)?.focus();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        {/* En el cajón, el título visible ES el título del diálogo (SheetTitle, también un <h2>): Radix lo usa para
            nombrar el diálogo. Antes había un SheetTitle oculto ADEMÁS de este <h2>, y el lector de pantalla anunciaba
            el nombre dos veces. Fuera del cajón no hay diálogo: un <h2> común. */}
        {enCajon
          ? <SheetTitle className="flex-1 font-heading text-base font-semibold">Mis notas y resaltados</SheetTitle>
          : <h2 className="flex-1 font-heading font-semibold">Mis notas y resaltados</h2>}
        <Button type="button" variant="ghost" size="icon" onClick={alCerrar}>
          <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
          <span className="sr-only">Cerrar el panel de notas</span>
        </Button>
      </div>

      {/* Aquí las pestañas van ARRIBA (en la barra izquierda van al pie, como en Readest): este panel se abre para
          algo puntual, y lo primero que se ve es qué lista es. El número: cuántas hay de cada una. */}
      <div role="tablist" aria-label="Qué mostrar" onKeyDown={alTeclear} className="grid grid-cols-2 gap-1 border-b border-border px-2 pb-2">
        {PESTANAS.map((p) => {
          const cuantas = p.id === "notas" ? notas.length : resaltados.length;
          return (
            <button key={p.id} type="button" role="tab" id={`${base}-tab-${p.id}`} aria-controls={`${base}-panel`}
                    aria-selected={pestana === p.id} tabIndex={pestana === p.id ? 0 : -1} onClick={() => alCambiarPestana(p.id)}
                    className={cn("flex items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      pestana === p.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60")}>
              <HugeiconsIcon icon={p.icono} className="size-4" aria-hidden="true" />
              {p.nombre}
              <span className="text-xs text-muted-foreground tabular-nums">{cuantas}</span>
            </button>
          );
        })}
      </div>

      {/* pb-20: en el escritorio, el botón flotante de sol y luna (DI-03, abajo a la derecha) queda sobre este panel;
          el espacio extra deja desplazar la última tarjeta por encima de él. */}
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${pestana}`} className="min-h-0 flex-1 overflow-y-auto p-3 pb-20">
        {pestana === "notas" ? (
          <NotasLibres notas={notas} maxNota={maxNota} capituloActual={capituloActual} pedidoNueva={pedidoNueva}
                       alCrear={alCrear} alEditar={alEditar} alBorrar={alBorrarNota} alIr={alIr} />
        ) : (
          <Resaltados resaltados={resaltados} alBorrar={alBorrarResaltado} alIr={alIr} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Notas libres (RN-86)
// ---------------------------------------------------------------------

function NotasLibres({ notas, maxNota, capituloActual, pedidoNueva, alCrear, alEditar, alBorrar, alIr }: {
  notas: NotaLibre[];
  maxNota: number;
  capituloActual: string | null;
  pedidoNueva: number;
  alCrear: (texto: string) => Respuesta;
  alEditar: (id: number, texto: string) => Respuesta;
  alBorrar: (id: number) => Respuesta;
  alIr: (cfi: string) => void;
}) {
  const nueva = useRef<HTMLTextAreaElement>(null);
  // "Nueva nota libre" desde el lápiz: el foco va al editor. pedidoNueva 0 = el panel se abrió por otra vía.
  useEffect(() => {
    if (pedidoNueva > 0) nueva.current?.focus();
  }, [pedidoNueva]);

  return (
    <div className="space-y-4">
      <Editor ref={nueva} id="nota-libre-nueva" etiqueta="Nueva nota libre" maxNota={maxNota} textoBoton="Guardar nota"
              ayuda={capituloActual ? `Se guarda en «${capituloActual}», donde vas leyendo.` : "Se guarda en la página donde vas leyendo."}
              alGuardar={alCrear} limpiarAlGuardar />

      {notas.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          Todavía no escribiste notas en este libro. Sirven para lo que quieras recordar, sin marcar un fragmento.
        </p>
      ) : (
        // <ol>: es una lista (la más reciente primero, como las trae la BD).
        <ol className="space-y-2">
          {notas.map((n) => (
            <li key={n.id_nota_libre}>
              <TarjetaNota nota={n} maxNota={maxNota} alEditar={alEditar} alBorrar={alBorrar} alIr={alIr} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TarjetaNota({ nota, maxNota, alEditar, alBorrar, alIr }: {
  nota: NotaLibre;
  maxNota: number;
  alEditar: (id: number, texto: string) => Respuesta;
  alBorrar: (id: number) => Respuesta;
  alIr: (cfi: string) => void;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <Editor id={`nota-libre-${nota.id_nota_libre}`} etiqueta="Editar la nota" maxNota={maxNota} inicial={nota.texto}
              textoBoton="Guardar cambios" enfocar
              alGuardar={async (t) => {
                const error = await alEditar(nota.id_nota_libre, t);
                if (!error) setEditando(false);
                return error;
              }}
              alCancelar={() => setEditando(false)} />
    );
  }
  return (
    <article className="space-y-2 rounded-xl border border-border bg-card p-3">
      {/* whitespace-pre-wrap: respeta los saltos de línea. Es TEXTO: React lo escapa, nunca es HTML (RN-87). */}
      <p className="text-sm whitespace-pre-wrap break-words">{nota.texto}</p>
      <p className="text-xs text-muted-foreground">
        {nota.capitulo && <>{nota.capitulo} · </>}
        {nota.fecha_creacion}
        {nota.editada ? " · editada" : ""}
      </p>
      <Acciones cfi={nota.cfi} textoIr="Ir a donde la escribí" alIr={alIr} alEditar={() => setEditando(true)}
                queBorra="esta nota" alBorrar={() => alBorrar(nota.id_nota_libre)} />
    </article>
  );
}

// El editor de una nota (nueva o existente): textarea, contador y guardar. forwardRef no hace falta en React 19: `ref`
// llega como una prop más.
function Editor({ ref, id, etiqueta, ayuda, maxNota, inicial = "", textoBoton, enfocar, limpiarAlGuardar, alGuardar, alCancelar }: {
  ref?: Ref<HTMLTextAreaElement>;
  id: string;
  etiqueta: string;
  ayuda?: string;
  maxNota: number;
  inicial?: string;
  textoBoton: string;
  enfocar?: boolean;
  limpiarAlGuardar?: boolean;
  alGuardar: (texto: string) => Respuesta;
  alCancelar?: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idUnico = `${useId()}-${id}`;
  const cuenta = largo(texto.trim());
  const exceso = cuenta > maxNota;

  async function guardar() {
    setGuardando(true);
    const e = await alGuardar(texto);
    setGuardando(false);
    setError(e);
    if (!e && limpiarAlGuardar) setTexto("");
  }

  return (
    <div className="space-y-2">
      <label htmlFor={idUnico} className="text-sm font-medium">{etiqueta}</label>
      {/* autoFocus solo al EDITAR una existente (el lector pidió editarla); la nueva toma el foco por el lápiz. */}
      <textarea ref={ref} id={idUnico} value={texto} rows={4} autoFocus={enfocar} placeholder="Escribe lo que quieras recordar…"
                onChange={(e) => setTexto(e.target.value)} aria-invalid={exceso || undefined}
                aria-describedby={ayuda ? `${idUnico}-ayuda` : undefined}
                // Ctrl+Enter (o Cmd+Enter) guarda, como en muchas apps de notas.
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && cuenta > 0 && !exceso && !guardando) void guardar(); }}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" />
      {ayuda && <p id={`${idUnico}-ayuda`} className="text-xs text-muted-foreground">{ayuda}</p>}
      {error && <p role="alert" className="text-sm text-danger-texto">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {/* El contador se pone rojo al pasarse; el servidor lo vuelve a comprobar (RN-86). */}
        <span className={cn("text-xs tabular-nums", exceso ? "text-danger-texto" : "text-muted-foreground")}>
          {cuenta} / {maxNota}
        </span>
        <div className="flex gap-1">
          {alCancelar && (
            <button type="button" onClick={alCancelar} className="rounded-lg px-3 py-1.5 text-sm hover:bg-muted">Cancelar</button>
          )}
          <button type="button" disabled={guardando || exceso || cuenta === 0} onClick={guardar}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {guardando ? "Guardando…" : textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Resaltados (RN-85)
// ---------------------------------------------------------------------

// En el ORDEN DEL LIBRO, no en el que se marcaron: compare de foliate-js ordena dos CFI por su lugar en el texto. Si un
// CFI no se puede interpretar (solo se validó su forma al guardarlo), compare lanza un error: esa marca va al final.
function enOrdenDelLibro(lista: Anotacion[]): Anotacion[] {
  return [...lista].sort((a, b) => {
    try {
      return compare(a.cfi, b.cfi);
    } catch {
      return a.id_anotacion - b.id_anotacion;
    }
  });
}

function Resaltados({ resaltados, alBorrar, alIr }: {
  resaltados: Anotacion[];
  alBorrar: (id: number) => Respuesta;
  alIr: (cfi: string) => void;
}) {
  // useMemo: ordenar solo cuando cambia la lista, no en cada render del panel.
  const ordenados = useMemo(() => enOrdenDelLibro(resaltados), [resaltados]);

  if (ordenados.length === 0) {
    return (
      <p className="px-1 text-sm text-muted-foreground">
        Todavía no marcaste fragmentos. Selecciona un texto del libro para resaltarlo, subrayarlo o agregarle una nota.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {ordenados.map((a) => {
        const c = COLOR_ANOTACION[a.color];
        return (
          <li key={a.id_anotacion}>
            {/* border-l-4 con el color de la marca (el de línea, que se ve en los tres temas): de un vistazo se sabe
                cuál es. El color calculado va en style: Tailwind no genera clases a partir de un valor de la BD. */}
            <article className="space-y-2 rounded-xl border border-l-4 border-border bg-card p-3" style={{ borderLeftColor: c.linea }}>
              {/* <blockquote>: es una cita del libro. line-clamp-4: una cita larga se corta con "…". */}
              <blockquote className="line-clamp-4 font-heading text-sm leading-relaxed">«{a.texto_citado}»</blockquote>
              {a.nota && <p className="rounded-lg bg-muted px-2.5 py-1.5 text-sm whitespace-pre-wrap break-words">{a.nota}</p>}
              <p className="text-xs text-muted-foreground">
                {c.nombre} · {NOMBRE_ESTILO_ANOTACION[a.estilo]} · {a.fecha_creacion}
              </p>
              {/* Editar el color, el estilo o la nota se hace sobre el texto (el menú junto a la marca): ahí se ve el
                  resultado. Aquí se va al pasaje o se borra. */}
              <Acciones cfi={a.cfi} textoIr="Ir al pasaje" alIr={alIr} queBorra="esta marca" alBorrar={() => alBorrar(a.id_anotacion)} />
            </article>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------
// Acciones de una tarjeta: ir, editar (opcional) y borrar con confirmación en el mismo lugar
// ---------------------------------------------------------------------

function Acciones({ cfi, textoIr, alIr, alEditar, queBorra, alBorrar }: {
  cfi: string | null;
  textoIr: string;
  alIr: (cfi: string) => void;
  alEditar?: () => void;
  queBorra: string;
  alBorrar: () => Respuesta;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Borrar no se deshace: se pide confirmar EN la tarjeta (sin un diálogo encima que tape lo que se va a borrar).
  if (confirmando) {
    return (
      <div className="space-y-1.5" role="group" aria-label="Confirmar borrado">
        <p className="text-sm">¿Borrar {queBorra}? No se puede deshacer.</p>
        {error && <p role="alert" className="text-sm text-danger-texto">{error}</p>}
        <div className="flex gap-1">
          {/* variant="destructive" del Button del proyecto: el par suave/texto de peligro (DI-09), con contraste. */}
          <Button type="button" variant="destructive" size="sm" disabled={borrando} autoFocus
                  onClick={async () => {
                    setBorrando(true);
                    const e = await alBorrar(); // si sale bien, la tarjeta desaparece (el visor la quita de la lista)
                    setBorrando(false);
                    setError(e);
                  }}>
            {borrando ? "Borrando…" : "Sí, borrar"}
          </Button>
          <button type="button" onClick={() => { setConfirmando(false); setError(null); }} className="rounded-lg px-3 py-1.5 text-sm hover:bg-muted">
            No
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {cfi && (
        <button type="button" onClick={() => alIr(cfi)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-muted">
          <HugeiconsIcon icon={Location01Icon} className="size-4" aria-hidden="true" />
          {textoIr}
        </button>
      )}
      {alEditar && (
        <button type="button" onClick={alEditar} className="rounded-lg px-2 py-1 text-sm hover:bg-muted">Editar</button>
      )}
      <button type="button" onClick={() => setConfirmando(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-danger-texto hover:bg-danger-suave">
        <HugeiconsIcon icon={Delete02Icon} className="size-4" aria-hidden="true" />
        Borrar
      </button>
    </div>
  );
}
