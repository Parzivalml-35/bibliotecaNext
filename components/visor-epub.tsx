"use client";

import { SidebarLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { FichaLibro } from "@/components/visor";
import { BarraLateral } from "@/components/visor-epub/barra-lateral";
import { TAMANOS_LETRA } from "@/components/visor-epub/ajustes-lectura";
import { Lapiz, MODOS_SELECCION, type ModoSeleccion } from "@/components/visor-epub/lapiz";
import { MenuResaltado } from "@/components/visor-epub/menu-resaltado";
import { type AjustesLectura, type Rectangulo, type Seleccion, useLibroEpub } from "@/components/visor-epub/motor";
import { usePreferencia } from "@/components/visor-epub/preferencias";
import { actualizarResaltado, borrarResaltado, guardarResaltado } from "@/lib/actions/lectura";
import {
  type Anotacion,
  type ColorAnotacion,
  type EstiloAnotacion,
  esColorAnotacion,
  esEstiloAnotacion,
} from "@/lib/lectura";

// RN-29, RN-84, DI-06: la INTERFAZ del visor EPUB, a casi pantalla completa (idea de Readest; código nuestro).
// El motor (foliate-js, la comprobación de la CSP, el tema, la rueda) está en components/visor-epub/motor.ts; aquí solo
// se dibuja con los datos neutros que entrega. No lo usan las páginas directamente: van por <Visor>.
//
// Escritorio (lg, 1024 px o más): la barra lateral fija a la izquierda, que se oculta y se muestra (se recuerda en este
// navegador). Celular: la barra es un cajón (Sheet) que se abre encima del libro.

const esSiNo = (v: string) => (v === "si" || v === "no" ? v : null);
// Lo guardado en localStorage se valida: un valor viejo o manipulado vuelve al valor por defecto.
const esLetra = (v: string) => (TAMANOS_LETRA.map(String).includes(v) ? v : null);
const esColumnas = (v: string) => (v === "1" || v === "2" ? v : null);
const esModo = (v: string) => ((MODOS_SELECCION as readonly string[]).includes(v) ? (v as ModoSeleccion) : null);
const esColor = (v: string) => (esColorAnotacion(v) ? v : null);
const esEstilo = (v: string) => (esEstiloAnotacion(v) ? v : null);

// El menú flotante abierto: sobre un texto recién seleccionado (existente: false, con su texto) o sobre una marca ya
// guardada (existente: true; sus datos se buscan por cfi en el estado).
type MenuAbierto = { rect: Rectangulo; cfi: string; texto: string; existente: boolean; conNota: boolean };

// "11/11/2026 14:05": la fecha de una marca recién creada, con el mismo formato que trae la BD.
const ahora = () => new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date());

export function VisorEpub({ url, ficha, portada, detalles, anotaciones: iniciales, maxNota }: {
  url: string;
  ficha: FichaLibro;
  portada: ReactNode;
  detalles: ReactNode;
  anotaciones: Anotacion[]; // RN-85: las marcas del lector en este título, leídas por la página en el servidor
  maxNota: number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const superficie = useRef<HTMLDivElement>(null);
  const [barraOculta, setBarraOculta] = usePreferencia("visor-epub:barra-oculta", "no", esSiNo);
  const [letra, setLetra] = usePreferencia("visor-epub:letra", "100", esLetra);
  const [columnas, setColumnas] = usePreferencia<"1" | "2">("visor-epub:columnas", "2", esColumnas);
  // useMemo: el mismo objeto mientras no cambien los valores. El motor reacciona a cambios de `ajustes`; un objeto
  // nuevo en cada render volvería a aplicar los estilos al libro sin necesidad.
  const ajustes = useMemo<AjustesLectura>(() => ({ letra: Number(letra), columnas: columnas === "1" ? 1 : 2 }), [letra, columnas]);
  const [cajonAbierto, setCajonAbierto] = useState(false);

  // RN-85: las marcas. El estado empieza con lo que trajo el servidor y se actualiza con la respuesta de cada acción.
  const [anotaciones, setAnotaciones] = useState(iniciales);
  // Lo que dibuja el motor (solo cfi, color y estilo). useMemo: el mismo arreglo mientras no cambien las marcas.
  const marcas = useMemo(() => anotaciones.map(({ cfi, color, estilo }) => ({ cfi, color, estilo })), [anotaciones]);
  // El lápiz: qué hace la selección y el color y estilo de los modos instantáneos (se recuerdan en este navegador).
  const [modo, setModo] = usePreferencia<ModoSeleccion>("visor-epub:modo", "menu", esModo);
  const [color, setColor] = usePreferencia<ColorAnotacion>("visor-epub:color", "amarillo", esColor);
  const [estilo, setEstilo] = usePreferencia<EstiloAnotacion>("visor-epub:estilo", "resaltado", esEstilo);
  const [menu, setMenu] = useState<MenuAbierto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso((a) => (a === texto ? null : a)), 6000); // se borra solo, si no lo reemplazó otro
  }

  // Marcar un fragmento (nuevo, o re-marcar uno existente: el servidor actualiza el mismo, RN-85).
  async function marcar(cfi: string, texto: string, rect: Rectangulo, c: ColorAnotacion, e: EstiloAnotacion, nota?: string) {
    setGuardando(true);
    const r = await guardarResaltado(ficha.isbn, { cfi, texto, color: c, estilo: e, nota });
    setGuardando(false);
    if (!r.ok) return avisar(r.error);
    limpiarSeleccion();
    setAnotaciones((lista) => {
      const previa = lista.find((a) => a.cfi === cfi);
      const notaFinal = nota?.trim() ? nota.trim() : (previa?.nota ?? null);
      if (previa) return lista.map((a) => (a.cfi === cfi ? { ...a, color: c, estilo: e, nota: notaFinal } : a));
      return [...lista, { id_anotacion: r.valor.id, cfi, texto_citado: r.valor.texto_citado, color: c, estilo: e,
        nota: notaFinal, fecha_creacion: ahora() }];
    });
    return rect;
  }

  // El motor avisa: texto seleccionado (o null para cerrar) y marca tocada.
  function alSeleccionar(s: Seleccion | null) {
    if (!s) return setMenu(null);
    if (modo === "menu") return setMenu({ rect: s.rect, cfi: s.cfi, texto: s.texto, existente: false, conNota: false });
    // Modos instantáneos: se marca ya, con el último color y estilo; "anotar" abre además el editor de la nota.
    void marcar(s.cfi, s.texto, s.rect, color, estilo).then((rect) => {
      if (rect && modo === "anotar") setMenu({ rect, cfi: s.cfi, texto: s.texto, existente: true, conNota: true });
    });
  }
  function alTocarMarca(cfi: string, rect: Rectangulo) {
    setMenu({ rect, cfi, texto: "", existente: true, conNota: false });
  }

  const { listo, error, indice, progreso, ir, izquierda, derecha, limpiarSeleccion } =
    useLibroEpub(url, contenedor, superficie, ajustes, { marcas, alSeleccionar, alTocarMarca });

  // useCallback: el menú usa alCerrar en un efecto (Esc); una función nueva en cada render lo re-ejecutaría.
  const alCerrar = useCallback(() => {
    setMenu(null);
    limpiarSeleccion();
  }, [limpiarSeleccion]);

  // Lo que muestra el menú: de la marca guardada si existe; si no, el color y estilo del lápiz.
  const marcaDelMenu = menu ? anotaciones.find((a) => a.cfi === menu.cfi) : undefined;

  async function alElegir(c: ColorAnotacion, e: EstiloAnotacion) {
    if (!menu) return;
    setColor(c); // el último usado queda para los modos instantáneos
    setEstilo(e);
    if (marcaDelMenu) {
      setGuardando(true);
      const r = await actualizarResaltado(marcaDelMenu.id_anotacion, { color: c, estilo: e, nota: marcaDelMenu.nota });
      setGuardando(false);
      if (!r.ok) return avisar(r.error);
      setAnotaciones((lista) => lista.map((a) => (a.cfi === menu.cfi ? { ...a, color: c, estilo: e } : a)));
    } else {
      await marcar(menu.cfi, menu.texto, menu.rect, c, e);
      setMenu(null);
    }
  }
  async function alGuardarNota(nota: string) {
    if (!menu) return;
    if (marcaDelMenu) {
      setGuardando(true);
      const r = await actualizarResaltado(marcaDelMenu.id_anotacion, { color: marcaDelMenu.color, estilo: marcaDelMenu.estilo, nota });
      setGuardando(false);
      if (!r.ok) return avisar(r.error);
      const limpia = nota.trim() || null;
      setAnotaciones((lista) => lista.map((a) => (a.cfi === menu.cfi ? { ...a, nota: limpia } : a)));
      setMenu(null);
    } else {
      // Nota sobre un texto todavía sin marcar: se marca con el color y estilo del lápiz, con la nota.
      if (await marcar(menu.cfi, menu.texto, menu.rect, color, estilo, nota)) setMenu(null);
    }
  }
  async function alBorrar() {
    if (!marcaDelMenu) return;
    setGuardando(true);
    const r = await borrarResaltado(marcaDelMenu.id_anotacion);
    setGuardando(false);
    if (!r.ok) return avisar(r.error);
    setAnotaciones((lista) => lista.filter((a) => a.id_anotacion !== marcaDelMenu.id_anotacion));
    setMenu(null);
  }

  const barra = (enCajon: boolean) => (
    <BarraLateral ficha={ficha} portada={portada} detalles={detalles} indice={indice} progreso={progreso}
                  ajustes={ajustes} alCambiarAjustes={(a) => { setLetra(String(a.letra)); setColumnas(a.columnas === 1 ? "1" : "2"); }}
                  // En el cajón, elegir un capítulo también lo cierra: si no, taparía la página a la que se saltó.
                  alElegir={(destino) => { ir(destino); if (enCajon) setCajonAbierto(false); }}
                  alOcultar={enCajon ? undefined : () => setBarraOculta("si")} />
  );

  return (
    // h-dvh: el alto visible de la pantalla (dvh: en el celular, sin la barra del navegador). bg-card tapa la pared con
    // su luz (DI-14): aquí manda el libro. El botón flotante de sol y luna (DI-03) sigue encima, en su esquina.
    <div className="flex h-dvh w-full bg-card print:hidden">
      {barraOculta === "no" && (
        // hidden lg:flex: en el celular esta barra no existe (está el cajón). w-72 = 18 rem; shrink-0: no se encoge.
        <aside aria-label="Libro e índice" className="hidden w-72 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
          {barra(false)}
        </aside>
      )}

      {/* El cajón del celular. Controlado (open/onOpenChange) para poder cerrarlo desde el índice. */}
      <Sheet open={cajonAbierto} onOpenChange={setCajonAbierto}>
        <SheetContent side="left" showCloseButton={false} className="w-80 p-0">
          {/* Radix exige un título en todo diálogo (lo anuncia el lector de pantalla); sr-only: no se ve. */}
          <SheetTitle className="sr-only">Libro e índice</SheetTitle>
          {barra(true)}
        </SheetContent>
      </Sheet>

      {/* min-w-0: sin él, un hijo flex no se encoge por debajo del ancho de su contenido (el libro desbordaría). */}
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 items-center gap-2 px-3">
          {/* Abrir la barra: en el celular abre el cajón; en el escritorio, solo si está oculta. */}
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setCajonAbierto(true)}>
            <HugeiconsIcon icon={SidebarLeft01Icon} aria-hidden="true" />
            <span className="sr-only">Abrir el panel del libro</span>
          </Button>
          {barraOculta === "si" && (
            <Button type="button" variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setBarraOculta("no")}>
              <HugeiconsIcon icon={SidebarLeft01Icon} aria-hidden="true" />
              <span className="sr-only">Mostrar el panel del libro</span>
            </Button>
          )}
          {/* El capítulo en curso, como el encabezado de página de un libro impreso. */}
          <p className="min-w-0 flex-1 truncate text-xs tracking-wide text-muted-foreground uppercase">
            {error ? "" : listo ? (progreso?.capitulo ?? "") : "Abriendo el libro…"}
          </p>
          {/* El lápiz, arriba a la derecha (R10). */}
          {listo && <Lapiz modo={modo} color={color} estilo={estilo} alCambiarModo={setModo} alCambiarColor={setColor} alCambiarEstilo={setEstilo} />}
        </div>
        {/* Avisos de las acciones (sin acceso, nota muy larga…). role="status": el lector de pantalla lo lee sin
            interrumpir. fixed + centrado arriba, sobre el libro. */}
        {aviso && (
          <p role="status" className="fixed top-14 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl border border-danger/40 bg-danger-suave px-4 py-2 text-sm text-danger-texto shadow-lg">
            {aviso}
          </p>
        )}
        {menu && (
          // key: otro texto u otra marca = un menú nuevo (su estado interno, como la nota que se escribe, empieza de cero).
          <MenuResaltado key={`${menu.cfi}-${menu.existente}`} maxNota={maxNota} guardando={guardando}
                         datos={{ rect: menu.rect, color: marcaDelMenu?.color ?? color, estilo: marcaDelMenu?.estilo ?? estilo,
                                  nota: marcaDelMenu?.nota ?? null, existente: !!marcaDelMenu, conNota: menu.conNota }}
                         alElegir={alElegir} alGuardarNota={alGuardarNota} alBorrar={alBorrar} alCerrar={alCerrar} />
        )}

        {error ? (
          <p role="alert" className="m-4 rounded-2xl border border-danger/40 bg-danger-suave px-4 py-3 text-sm text-danger-texto">{error}</p>
        ) : (
          // flex-1 min-h-0: toma todo el alto que queda (el libro se pagina dentro). relative: las zonas laterales van
          // encima con absolute. ref superficie: el motor escucha la rueda aquí, que envuelve al libro Y a las zonas.
          <div ref={superficie} className="relative min-h-0 flex-1">
            <div ref={contenedor} role="document" aria-label={ficha.titulo} onContextMenu={(e) => e.preventDefault()}
                 className="h-full" />
            {/* Zonas laterales para el TECLADO y el lector de pantalla: <button> con nombre, a los que se llega con Tab.
                pointer-events-none: el mouse y el dedo las atraviesan y llegan al libro (encima del texto impedían
                seleccionar el comienzo de las líneas); el clic en los bordes lo atiende el motor dentro del capítulo. */}
            <button type="button" aria-label="Página anterior" disabled={!listo} onClick={izquierda}
                    className="pointer-events-none absolute inset-y-0 left-0 w-[10%] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" />
            <button type="button" aria-label="Página siguiente" disabled={!listo} onClick={derecha}
                    className="pointer-events-none absolute inset-y-0 right-0 w-[10%] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" />
          </div>
        )}

        {/* Contador de ubicaciones (las de foliate-js: no cambian con el tamaño de la pantalla). aria-live: el lector de
            pantalla anuncia el avance. pr-20: deja libre la esquina del botón flotante de sol y luna (DI-03). */}
        <p aria-live="polite" className="flex h-11 items-center justify-end pr-20 text-xs text-muted-foreground tabular-nums">
          {listo && progreso ? (
            <>
              <span className="sr-only">Ubicación </span>
              {progreso.pagina} / {progreso.total}
              <span className="sr-only">, {Math.round(progreso.fraccion * 100)} % del libro</span>
            </>
          ) : null}
        </p>
      </main>
    </div>
  );
}
