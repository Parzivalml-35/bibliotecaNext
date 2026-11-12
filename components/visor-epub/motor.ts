"use client";

import { type RefObject, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { EntradaToc, Libro, View } from "foliate-js/view.js";
import { COLOR_ANOTACION, type ColorAnotacion, type EstiloAnotacion } from "@/lib/lectura";

// El MOTOR del visor EPUB (foliate-js), separado de la interfaz. Abre el libro dentro de `contenedor` y entrega datos
// neutros (índice, progreso) y acciones (ir, avanzar, retroceder). La interfaz (components/visor-epub.tsx y
// components/visor-epub/*) no conoce los objetos de foliate-js: si algún día se cambia de motor (DI-06, Readium), se
// reescribe este archivo y la interfaz sigue igual.
//
// SEGURIDAD (RN-84). foliate-js NO bloquea el JavaScript del libro: dibuja cada capítulo en un <iframe> con
// sandbox="allow-same-origin allow-scripts" (bug de WebKit) y src blob: de nuestro origen. Lo bloquea la CSP que
// proxy.ts pone en /leer/<isbn>. Pero la CSP es una cabecera del DOCUMENTO: si se llegó aquí con una navegación del
// cliente (p. ej. el redirect() del login con ?siguiente=), el documento es el de la página anterior, sin CSP.
// Por eso, antes de abrir nada, se comprueba en qué URL se cargó el documento; si no es esta, se recarga.

// Una entrada del índice, ya con su página. nivel: 0 para los capítulos, 1 para sus subcapítulos, etc.
// pagina: null si el destino no está en el libro (índice mal armado).
export type EntradaIndice = { titulo: string; destino: string; pagina: number | null; nivel: number };
// Dónde va el lector. pagina/total son "ubicaciones" de 1500 bytes (las de foliate-js): no son páginas impresas,
// pero no cambian con el tamaño de la pantalla, así que sirven para ubicarse. capitulo/destino: la entrada del
// índice en la que está (null antes del primer capítulo). cfi: el punto exacto del comienzo de la pantalla (para una
// nota libre que recuerde dónde se escribió, RN-86; ir(cfi) vuelve ahí).
export type Progreso = {
  capitulo: string | null;
  destino: string | null;
  cfi: string | null;
  pagina: number;
  total: number;
  fraccion: number;
};
// Ajustes de lectura de este navegador: tamaño de letra en % y cuántas columnas como máximo (2 solo si caben).
export type AjustesLectura = { letra: number; columnas: 1 | 2 };
// RN-85: lo que el motor dibuja sobre el texto. cfi: dónde (EPUB CFI); color y estilo: cómo.
export type Marca = { cfi: string; color: ColorAnotacion; estilo: EstiloAnotacion };
// Un rectángulo en coordenadas de la PÁGINA (no del capítulo): para ubicar un menú junto al texto.
export type Rectangulo = { x: number; y: number; ancho: number; alto: number };
// Texto seleccionado por el lector en el libro.
export type Seleccion = { cfi: string; texto: string; rect: Rectangulo };
// Las marcas a dibujar y qué hacer cuando el lector selecciona texto o toca una marca.
export type OpcionesDeMarcas = {
  marcas: Marca[];
  alSeleccionar: (seleccion: Seleccion | null) => void; // null: se deshizo la selección (o se pasó de página)
  alTocarMarca: (cfi: string, rect: Rectangulo) => void;
  alInteractuar: () => void; // RN-88: cualquier toque, tecla o movimiento dentro de un capítulo
};

// foliate-js (view.js: new SectionProgress(book.sections, 1500, 1600)) cuenta una "ubicación" cada 1500 bytes de texto.
const BYTES_POR_UBICACION = 1500;
// Rueda y touchpad: UN GESTO = UNA PÁGINA. Un gesto del touchpad (o una muesca de una rueda de alta resolución, en
// Wayland) llega como decenas de eventos pequeños, de 1 a 15 px, seguidos de la inercia. Decidir evento por evento
// fallaba de dos formas (encontrado con el usuario, 2026-11-12): un gesto suave, todo en eventos de menos de 4 px, no
// pasaba nada (había que repetirlo más fuerte), y la inercia pasaba varias páginas. Ahora se SUMA el gesto: al juntar
// UMBRAL_RUEDA px en un sentido se pasa una página, y el resto del gesto se ignora hasta que la rueda quede quieta
// FIN_GESTO ms.
const UMBRAL_RUEDA = 20; // px; una muesca de un mouse común (50 a 120 px) lo supera sola
const FIN_GESTO = 250; // ms sin eventos = el gesto terminó (la inercia manda eventos cada ~16 ms)
const PX_POR_LINEA = 16; // deltaMode 1: hay ratones y navegadores que informan en líneas, no en píxeles
// Zonas para pasar página con el mouse o el dedo: un clic (sin arrastrar) en el 20 % izquierdo o derecho del área de
// lectura. Se detectan DENTRO del capítulo y no con elementos encima del texto: un elemento encima tapaba el comienzo
// de las líneas e impedía seleccionar desde ahí (encontrado probando R10-C).
const ZONA_PAGINA = 0.2;

// ¿El documento se cargó (navegación completa) en esta misma ruta? performance.getEntriesByType("navigation") describe
// la carga del documento actual y no cambia con las navegaciones del cliente.
function documentoCargadoAqui(): boolean {
  const [carga] = performance.getEntriesByType("navigation");
  return !!carga && new URL(carga.name).pathname === location.pathname;
}

// El CSS que se inyecta en cada capítulo: los colores del tema activo y el tamaño de letra elegido.
// Los colores del tema activo para el texto del libro (DI-06). Las variables CSS están en <html> (globals.css) y cambian
// con data-tema; los capítulos viven en iframes, que no las heredan: se leen aquí y se escriben en su CSS.
// Fondo TRANSPARENTE: se ve el fondo del contenedor, que ya sigue el tema. (foliate-js pinta los márgenes con el fondo
// que lee del capítulo al cargarlo y no lo vuelve a leer: con un color fijo, al cambiar de tema el marco quedaba con el
// color anterior.)
function estiloDelLibro(ajustes: AjustesLectura): string {
  const raiz = getComputedStyle(document.documentElement);
  const v = (nombre: string) => raiz.getPropertyValue(nombre).trim();
  // color-scheme IGUAL al de la página: si el iframe y la página no coinciden, el navegador pinta el iframe con un
  // fondo opaco (blanco o negro) y el fondo transparente no sirve. Se copia el que la página tiene calculado.
  return `
    html { color-scheme: ${raiz.colorScheme || "normal"}; }
    html, body { background: transparent !important; color: ${v("--foreground")} !important; }
    a:link, a:visited { color: ${v("--primary")} !important; }
    p, li, blockquote { line-height: 1.6; hyphens: auto; }
    /* Tamaño de letra: sobre <html>, así escala todo lo que el libro mide en em o rem (los px quedan igual). */
    html { font-size: ${ajustes.letra}% !important; }
  `;
}

// El rectángulo de un rango del capítulo, pasado a coordenadas de la página: el del rango es relativo a su iframe, y
// frameElement es ese iframe dentro de la página (accesible porque es del mismo origen).
function rectEnPagina(rango: Range): Rectangulo {
  const r = rango.getBoundingClientRect();
  const marco = rango.startContainer.ownerDocument?.defaultView?.frameElement?.getBoundingClientRect();
  return { x: (marco?.left ?? 0) + r.left, y: (marco?.top ?? 0) + r.top, ancho: r.width, alto: r.height };
}

// El índice del libro, aplanado (los subcapítulos quedan debajo de su capítulo, con nivel + 1) y con la página donde
// empieza cada entrada: la misma cuenta que hace foliate-js para location.current (bytes de las secciones lineales
// anteriores / 1500). Para un subcapítulo que empieza a mitad de una sección, es la página de inicio de esa sección.
function indiceDe(libro: Libro): EntradaIndice[] {
  const tamanos = libro.sections.map((s) => (s.linear !== "no" && s.size > 0 ? s.size : 0));
  const antes: number[] = [];
  tamanos.reduce((acumulado, t, i) => ((antes[i] = acumulado), acumulado + t), 0);

  const salida: EntradaIndice[] = [];
  const recorrer = (entradas: EntradaToc[], nivel: number) => {
    for (const e of entradas) {
      const indice = libro.resolveHref(e.href)?.index ?? -1;
      salida.push({
        titulo: e.label?.trim() || "(sin título)",
        destino: e.href,
        pagina: indice >= 0 ? Math.floor(antes[indice] / BYTES_POR_UBICACION) + 1 : null,
        nivel,
      });
      if (e.subitems?.length) recorrer(e.subitems, nivel + 1);
    }
  };
  recorrer(libro.toc ?? [], 0);
  return salida;
}

// RN-88: dónde abrir el libro (lo guardado por el latido). cfi: el punto exacto; fraccion: el respaldo si el CFI ya no
// sirve (otro archivo del mismo título, por ejemplo).
export type InicioLectura = { cfi: string | null; fraccion: number };

// contenedor: donde se monta el libro. superficie: lo que lo envuelve junto con los controles que van encima (las zonas
// laterales); ahí se escucha la rueda, para que funcione también con el puntero sobre esos controles.
export function useLibroEpub(
  url: string,
  contenedor: RefObject<HTMLDivElement | null>,
  superficie: RefObject<HTMLElement | null>,
  ajustes: AjustesLectura,
  opciones: OpcionesDeMarcas,
  inicio: InicioLectura | null,
) {
  const vista = useRef<View | null>(null);
  // Las marcas vigentes (para dibujar cuando foliate lo pida) y las ya dibujadas (para saber qué cambió).
  const marcasVigentes = useRef(new Map<string, Marca>());
  const marcasDibujadas = useRef(new Map<string, Marca>());
  // El capítulo donde está la última selección, para poder deshacerla.
  const docSeleccion = useRef<Document | null>(null);
  // useEffectEvent (React 19.2): una función que los listeners del efecto llaman y que SIEMPRE ve las props más
  // recientes, sin ser dependencia del efecto. Si alSeleccionar fuera dependencia, cada render de la interfaz cerraría
  // y volvería a abrir el libro.
  const avisarSeleccion = useEffectEvent((s: Seleccion | null) => opciones.alSeleccionar(s));
  const avisarMarca = useEffectEvent((cfi: string, rect: Rectangulo) => opciones.alTocarMarca(cfi, rect));
  const avisarActividad = useEffectEvent(() => opciones.alInteractuar());
  // Los ajustes vigentes, para quien los lee "después" (al abrir el libro, al cambiar el tema). Una ref y no una
  // dependencia del efecto principal: cambiar la letra NO debe cerrar y volver a abrir el libro.
  const ajustesVigentes = useRef(ajustes);
  // Solo se usa al abrir: una ref para no ser dependencia del efecto principal (cambiaría con cada latido si lo fuera).
  const inicioAlAbrir = useRef(inicio);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indice, setIndice] = useState<EntradaIndice[]>([]);
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  // Cambio de ajustes con el libro abierto: se aplican en el momento. Va ANTES del efecto principal: los efectos corren
  // en orden, así la ref ya tiene los ajustes guardados cuando el principal abre el libro.
  useEffect(() => {
    ajustesVigentes.current = ajustes;
    const v = vista.current;
    if (!v || !listo) return;
    v.renderer.setAttribute("max-column-count", String(ajustes.columnas));
    v.renderer.setStyles(estiloDelLibro(ajustes));
  }, [ajustes, listo]);

  // Cambio de marcas con el libro abierto: se borran las que ya no están y se (re)dibujan las nuevas o cambiadas.
  // addAnnotation solo dibuja si su capítulo está cargado; los demás se dibujan al cargarse (evento create-overlay).
  useEffect(() => {
    const nuevas = new Map(opciones.marcas.map((m) => [m.cfi, m]));
    marcasVigentes.current = nuevas;
    const v = vista.current;
    if (!v || !listo) return;
    const antes = marcasDibujadas.current;
    for (const cfi of antes.keys()) if (!nuevas.has(cfi)) void v.deleteAnnotation({ value: cfi });
    for (const [cfi, m] of nuevas) {
      const a = antes.get(cfi);
      if (!a || a.color !== m.color || a.estilo !== m.estilo) void v.addAnnotation({ value: cfi });
    }
    marcasDibujadas.current = nuevas;
  }, [opciones.marcas, listo]);

  useEffect(() => {
    if (!documentoCargadoAqui()) {
      location.reload(); // navegación completa: ahora sí llega la CSP de proxy.ts
      return;
    }
    let cancelado = false;
    let abierta: View | null = null;
    // El gesto de rueda en curso: cuánto se lleva sumado, cuándo llegó el último evento y si ya pasó su página.
    let sumaRueda = 0;
    let ultimoEventoRueda = 0;
    let gestoUsado = false;
    let ultimoToqueMarca = 0; // el clic sobre una marca abre su menú: no debe pasar de página
    // El tema puede cambiar mientras se lee (botón flotante, lámpara): un MutationObserver sobre <html> vuelve a
    // escribir los colores en el libro.
    const observador = new MutationObserver(() => abierta?.renderer.setStyles(estiloDelLibro(ajustesVigentes.current)));

    // Flechas: goLeft/goRight respetan los libros de derecha a izquierda.
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") void abierta?.goLeft();
      if (e.key === "ArrowRight") void abierta?.goRight();
    }
    // Clic en x (coordenada de la página): si cae en el 20 % izquierdo o derecho del área de lectura, pasa de página.
    function pasarSiEsBorde(x: number) {
      const area = superficie.current?.getBoundingClientRect();
      if (!area) return;
      if (x < area.left + area.width * ZONA_PAGINA) void abierta?.goLeft();
      else if (x > area.right - area.width * ZONA_PAGINA) void abierta?.goRight();
    }
    // El clic en los MÁRGENES del área (fuera del iframe del capítulo): los del capítulo no llegan aquí.
    function alHacerClicEnMargen(ev: MouseEvent) {
      if (ev.button === 0) pasarSiEsBorde(ev.clientX);
    }

    // Rueda: hacia abajo (o hacia la derecha en el touchpad) avanza. next/prev siguen el orden de lectura.
    // preventDefault: que la rueda no desplace también la página. Por eso se registra con { passive: false }.
    function alGirar(e: WheelEvent) {
      e.preventDefault(); // la rueda nunca desplaza la página: aquí solo pasa páginas
      const crudo = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      // A píxeles: deltaMode 0 = píxeles, 1 = líneas, 2 = páginas (WheelEvent, estándar del DOM).
      const delta = e.deltaMode === 1 ? crudo * PX_POR_LINEA : e.deltaMode === 2 ? crudo * window.innerHeight : crudo;
      const ahora = performance.now();
      // Un hueco de FIN_GESTO ms sin eventos: empieza un gesto nuevo.
      if (ahora - ultimoEventoRueda > FIN_GESTO) {
        sumaRueda = 0;
        gestoUsado = false;
      }
      ultimoEventoRueda = ahora;
      if (gestoUsado) return; // el resto del gesto (la inercia) ya no pasa más páginas
      // Si el gesto cambia de sentido, la suma empieza de nuevo (Math.sign: -1, 0 o 1).
      if (Math.sign(delta) !== Math.sign(sumaRueda)) sumaRueda = 0;
      sumaRueda += delta;
      if (Math.abs(sumaRueda) < UMBRAL_RUEDA) return;
      gestoUsado = true;
      void (sumaRueda > 0 ? abierta?.next() : abierta?.prev());
    }

    (async () => {
      try {
        // fetch() lleva la cookie de sesión y manda Sec-Fetch-Dest: empty, lo que exige la ruta (RN-29).
        const respuesta = await fetch(url, { cache: "no-store" });
        if (!respuesta.ok) throw new Error(await respuesta.text());
        // foliate-js recibe un File: reconoce el EPUB por su contenido (empieza por "PK", es un ZIP).
        const archivo = new File([await respuesta.blob()], "libro.epub", { type: "application/epub+zip" });
        // import() dinámico: foliate-js solo existe en el navegador (define un custom element), así que no entra en
        // el render del servidor. Importarlo registra <foliate-view>.
        await import("foliate-js/view.js");
        const { Overlayer } = await import("foliate-js/overlayer.js");
        if (cancelado || !contenedor.current) return;

        const v = document.createElement("foliate-view") as View;
        abierta = v;
        vista.current = v;
        v.style.display = "block";
        v.style.height = "100%";
        contenedor.current.append(v);
        v.addEventListener("relocate", (e) => {
          const d = (e as CustomEvent<{ fraction: number; location?: { current: number; total: number };
            tocItem?: { label?: string; href?: string }; cfi?: string }>).detail;
          avisarSeleccion(null); // al pasar de página, un menú abierto quedaría lejos de su texto
          const pagina = (d.location?.current ?? 0) + 1;
          const total = d.location?.total ?? 0;
          setProgreso({
            capitulo: d.tocItem?.label?.trim() || null,
            destino: d.tocItem?.href ?? null,
            cfi: d.cfi ?? null, // view.js (#onRelocate) lo calcula con getCFI del rango visible
            pagina,
            total,
            // foliate-js (paginator.js) calcula la fracción como (page - 1) / (pages - 2): en una sección de una sola
            // pantalla (la portada) da 0 / 0 = NaN. Entonces se usa la cuenta de ubicaciones.
            fraccion: Number.isFinite(d.fraction) ? d.fraction : total > 0 ? Math.min(1, (pagina - 1) / total) : 0,
          });
        });
        // Cada capítulo es OTRO documento (un iframe): el teclado y la rueda que ocurren dentro no llegan a la página.
        v.addEventListener("load", (e) => {
          const { doc, index } = (e as CustomEvent<{ doc: Document; index: number }>).detail;
          doc.addEventListener("keydown", alPresionar);
          // RN-88: actividad dentro del capítulo (el latido no la ve: es otro documento). passive: solo se anota.
          for (const tipo of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
            doc.addEventListener(tipo, () => avisarActividad(), { passive: true });
          }
          doc.addEventListener("wheel", alGirar, { passive: false });
          // RN-85: selección de texto. Al empezar a tocar, se cierra cualquier menú; al soltar, si quedó texto
          // seleccionado, se avisa con su CFI. setTimeout: la selección termina de actualizarse DESPUÉS de pointerup.
          // (Un clic sobre una marca no deja selección: lo atiende "show-annotation".)
          doc.addEventListener("pointerdown", () => avisarSeleccion(null));
          // Zonas laterales: un clic simple en el borde pasa de página. setTimeout: deja actuar primero a foliate (que
          // en el mismo clic avisa si se tocó una marca). No cuenta si quedó texto seleccionado (fue un arrastre),
          // si se tocó un enlace o una marca, ni si no fue el botón principal.
          doc.addEventListener("click", (ev) => {
            if (ev.button !== 0 || (ev.target as Element | null)?.closest?.("a")) return;
            setTimeout(() => {
              if (performance.now() - ultimoToqueMarca < 400 || !doc.getSelection()?.isCollapsed) return;
              const marco = doc.defaultView?.frameElement?.getBoundingClientRect();
              if (marco) pasarSiEsBorde(marco.left + ev.clientX); // coordenada del clic en la PÁGINA
            }, 0);
          });
          doc.addEventListener("pointerup", () => setTimeout(() => {
            const sel = doc.getSelection();
            if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
            const rango = sel.getRangeAt(0);
            const texto = sel.toString().trim();
            if (!texto) return;
            let cfi: string;
            try {
              cfi = v.getCFI(index, rango);
            } catch {
              return; // un rango que foliate no sabe ubicar (fuera del texto): no se ofrece marcarlo
            }
            docSeleccion.current = doc;
            avisarSeleccion({ cfi, texto, rect: rectEnPagina(rango) });
          }, 0));
        });
        // RN-85: dibujar una marca. foliate entrega `draw` y la marca (value = CFI); el estilo y el color salen de las
        // marcas vigentes. El resaltado va con el color de fondo (foliate le pone 30 % de opacidad); las líneas, con
        // el color de línea, más oscuro.
        v.addEventListener("draw-annotation", (e) => {
          const { draw, annotation } = (e as CustomEvent<{
            draw: (forma: unknown, opciones?: { color?: string; width?: number }) => void;
            annotation: { value: string };
          }>).detail;
          const m = marcasVigentes.current.get(annotation.value);
          if (!m) return;
          const c = COLOR_ANOTACION[m.color];
          if (m.estilo === "resaltado") draw(Overlayer.highlight, { color: c.fondo });
          else draw(m.estilo === "subrayado" ? Overlayer.underline : Overlayer.squiggly, { color: c.linea, width: 2 });
        });
        // Un capítulo nuevo en pantalla: se piden todas las marcas; foliate dibuja solo las de ESE capítulo.
        v.addEventListener("create-overlay", () => {
          for (const cfi of marcasVigentes.current.keys()) void v.addAnnotation({ value: cfi });
        });
        // Clic sobre una marca: la interfaz abre su menú (color, estilo, nota, borrar) junto a ella.
        v.addEventListener("show-annotation", (e) => {
          const { value, range } = (e as CustomEvent<{ value: string; range: Range }>).detail;
          ultimoToqueMarca = performance.now();
          avisarMarca(value, rectEnPagina(range));
        });
        // Enlaces a otros sitios: foliate-js los abriría con window.open(href, "_blank"), y la página abierta tendría
        // window.opener apuntando aquí (tabnabbing). Se cancela y se abre con noopener, solo si es http(s).
        v.addEventListener("external-link", (e) => {
          e.preventDefault();
          const { href } = (e as CustomEvent<{ href: string }>).detail;
          if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
        });

        await v.open(archivo);
        if (cancelado) return;
        v.renderer.setAttribute("flow", "paginated");
        v.renderer.setAttribute("max-inline-size", "720px");
        v.renderer.setAttribute("gap", "6%");
        v.renderer.setAttribute("max-column-count", String(ajustesVigentes.current.columnas));
        v.renderer.setStyles(estiloDelLibro(ajustesVigentes.current));
        observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "data-tema-base"] });
        setIndice(indiceDe(v.book));
        // RN-88: seguir donde iba. Primero el CFI exacto; si foliate no lo puede ubicar (goTo devuelve undefined), la
        // fracción; si tampoco hay, la primera página.
        const desde = inicioAlAbrir.current;
        let ubicado = false;
        if (desde?.cfi) ubicado = (await v.goTo(desde.cfi)) !== undefined;
        if (!ubicado && desde && desde.fraccion > 0) {
          try {
            await v.goToFraction(desde.fraccion);
            ubicado = true;
          } catch {
            // un libro sin secciones lineales: se queda en la primera página
          }
        }
        if (!ubicado) await v.renderer.next(); // muestra la primera página
        marcasDibujadas.current = new Map(marcasVigentes.current); // las dibuja create-overlay al cargar cada capítulo
        setListo(true);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error && e.message ? e.message : "No se pudo abrir el libro.");
      }
    })();

    // La rueda fuera de los iframes (márgenes y zonas laterales). Se toma el elemento al montar: la limpieza tiene que
    // quitar el listener del MISMO elemento, aunque la ref cambie después.
    const caja = superficie.current;
    window.addEventListener("keydown", alPresionar);
    caja?.addEventListener("wheel", alGirar, { passive: false });
    caja?.addEventListener("click", alHacerClicEnMargen);

    return () => {
      cancelado = true;
      observador.disconnect();
      window.removeEventListener("keydown", alPresionar);
      caja?.removeEventListener("wheel", alGirar);
      caja?.removeEventListener("click", alHacerClicEnMargen);
      abierta?.close(); // libera los capítulos y sus blob:
      abierta?.remove();
      vista.current = null;
    };
  }, [url, contenedor, superficie]);

  // Deshace la selección de texto en el libro (después de marcarla, o al cancelar). useCallback: la misma función en
  // cada render (la interfaz la usa como dependencia; solo lee una ref).
  const limpiarSeleccion = useCallback(() => docSeleccion.current?.getSelection()?.removeAllRanges(), []);

  return {
    listo,
    error,
    indice,
    progreso,
    ir: (destino: string) => void vista.current?.goTo(destino),
    // Los botones y las zonas laterales son "izquierda" y "derecha" en pantalla: respetan el sentido del libro.
    izquierda: () => void vista.current?.goLeft(),
    derecha: () => void vista.current?.goRight(),
    limpiarSeleccion,
  };
}
