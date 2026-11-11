"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent, type SyntheticEvent, useRef, useState } from "react";

// RN-82: vista previa de la foto elegida con el círculo del avatar encima; se arrastra para centrarla y se ajusta el
// zoom. La foto NO se sube para verla: `url` es un blob: de URL.createObjectURL (lo crea y lo libera FormularioAvatar).
// Lo que se envía son tres campos ocultos con la zona en fracciones de la foto (ver Recorte en lib/foto-avatar.ts);
// el servidor los valida, los ajusta y recorta. Sin JavaScript este componente no existe y se recorta al centro.

const ZOOM_MAXIMO = 3;
const PASO_TECLADO = 0.05; // fracción del recuadro que se mueve con cada flecha
const acotar = (valor: number, minimo: number, maximo: number) => Math.min(maximo, Math.max(minimo, valor));

type Tamano = { ancho: number; alto: number };
type Posicion = { x: number; y: number }; // esquina superior izquierda de la zona, en fracciones de ancho y alto

// Qué fracción del ancho y del alto de la foto cabe en el recuadro con este zoom (zoom 1 = el lado corto entero).
function visible(tam: Tamano, zoom: number) {
  const corto = Math.min(tam.ancho, tam.alto);
  return { x: corto / (zoom * tam.ancho), y: corto / (zoom * tam.alto) };
}

// La zona nunca sale de la foto: la esquina va de 0 a (1 - lo que se ve).
function dentro(p: Posicion, v: { x: number; y: number }): Posicion {
  return { x: acotar(p.x, 0, 1 - v.x), y: acotar(p.y, 0, 1 - v.y) };
}

// La foto posicionada en PORCENTAJES del recuadro: ancho = (ancho / lado corto) × zoom veces el recuadro, desplazada
// hacia la izquierda y hacia arriba según la esquina elegida. Como todo es relativo al recuadro, el mismo estilo sirve
// para el recuadro grande y para la miniatura. maxWidth "none": el reset de Tailwind pone max-width: 100% a las <img>.
function estiloFoto(tam: Tamano, zoom: number, p: Posicion): CSSProperties {
  const corto = Math.min(tam.ancho, tam.alto);
  const escalaX = (tam.ancho / corto) * zoom;
  const escalaY = (tam.alto / corto) * zoom;
  return {
    position: "absolute", maxWidth: "none",
    width: `${escalaX * 100}%`, height: `${escalaY * 100}%`,
    left: `${-p.x * escalaX * 100}%`, top: `${-p.y * escalaY * 100}%`,
  };
}

// FormularioAvatar le pone key={url}: con otra foto, React crea un componente nuevo y el estado empieza de cero.
export function AjusteFoto({ url, alFallar }: { url: string; alFallar: () => void }) {
  const [tam, setTam] = useState<Tamano | null>(null); // null hasta que el navegador decodifica la foto
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Posicion>({ x: 0, y: 0 });
  const recuadro = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number } | null>(null); // última posición del puntero mientras se arrastra

  // naturalWidth/naturalHeight: el tamaño real, ya con la orientación EXIF aplicada (los navegadores enderezan las
  // fotos al mostrarlas). Es el mismo sistema de coordenadas que usa el servidor (metadata().autoOrient).
  function alCargar(evento: SyntheticEvent<HTMLImageElement>) {
    const t = { ancho: evento.currentTarget.naturalWidth, alto: evento.currentTarget.naturalHeight };
    const v = visible(t, 1);
    setTam(t);
    setPos({ x: (1 - v.x) / 2, y: (1 - v.y) / 2 }); // empieza centrada, como recorta el servidor sin zona
  }

  // Mover la zona `dx`, `dy` píxeles de pantalla. El recuadro mide `lado` px y en él cabe `v` de la foto, así que
  // un píxel equivale a v / lado de la foto. Arrastrar la foto a la derecha mueve la ZONA a la izquierda: por eso resta.
  function mover(dx: number, dy: number) {
    if (!tam || !recuadro.current) return;
    const lado = recuadro.current.clientWidth;
    const v = visible(tam, zoom);
    setPos((p) => dentro({ x: p.x - (dx / lado) * v.x, y: p.y - (dy / lado) * v.y }, v));
  }

  // El zoom se aplica alrededor del CENTRO de lo que se ve: si no, acercar movería la foto hacia la esquina.
  function cambiarZoom(nuevo: number) {
    if (!tam) return;
    const z = acotar(nuevo, 1, ZOOM_MAXIMO);
    const antes = visible(tam, zoom);
    const despues = visible(tam, z);
    const centro = { x: pos.x + antes.x / 2, y: pos.y + antes.y / 2 };
    setZoom(z);
    setPos(dentro({ x: centro.x - despues.x / 2, y: centro.y - despues.y / 2 }, despues));
  }

  // Pointer events: un solo código para mouse, dedo y lápiz. setPointerCapture hace que el recuadro siga recibiendo
  // los movimientos aunque el puntero salga de él mientras arrastra.
  function empezar(evento: PointerEvent<HTMLDivElement>) {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastre.current = { x: evento.clientX, y: evento.clientY };
  }
  function arrastrar(evento: PointerEvent<HTMLDivElement>) {
    if (!arrastre.current) return;
    mover(evento.clientX - arrastre.current.x, evento.clientY - arrastre.current.y);
    arrastre.current = { x: evento.clientX, y: evento.clientY };
  }
  const soltar = () => { arrastre.current = null; };

  // Teclado: flechas para mover y +/- para el zoom. preventDefault solo en las teclas que se usan (si no, las flechas
  // también desplazarían la página).
  function tecla(evento: KeyboardEvent<HTMLDivElement>) {
    const lado = recuadro.current?.clientWidth ?? 0;
    const paso = lado * PASO_TECLADO;
    const acciones: Record<string, () => void> = {
      ArrowLeft: () => mover(paso, 0), ArrowRight: () => mover(-paso, 0),
      ArrowUp: () => mover(0, paso), ArrowDown: () => mover(0, -paso),
      "+": () => cambiarZoom(zoom + 0.1), "=": () => cambiarZoom(zoom + 0.1), "-": () => cambiarZoom(zoom - 0.1),
    };
    const accion = acciones[evento.key];
    if (accion) {
      evento.preventDefault();
      accion();
    }
  }

  const estilo = tam ? estiloFoto(tam, zoom, pos) : { position: "absolute" as const, inset: 0, opacity: 0 };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-5">
        {/* El recuadro: overflow-hidden recorta la foto; touch-none evita que el arrastre con el dedo desplace la
            página; select-none evita que se seleccione la imagen al arrastrar con el mouse. */}
        <div ref={recuadro} tabIndex={0} role="group"
             aria-label="Ajustar la foto. Arrastra o usa las flechas para moverla, y + o - para el zoom."
             onPointerDown={empezar} onPointerMove={arrastrar} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={tecla}
             className="relative aspect-square w-full max-w-64 cursor-grab touch-none overflow-hidden rounded-2xl border border-border bg-muted select-none active:cursor-grabbing focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          {/* <img> y no next/image: es un blob: local que no se puede optimizar ni hace falta. alt="": el grupo ya
              explica qué es; la foto en sí no aporta texto. draggable={false}: sin esto el navegador arrastra la imagen
              como archivo en vez de mandarnos los pointer events. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" draggable={false} onLoad={alCargar} onError={alFallar} style={estilo} />
          {/* El círculo: un div redondo con una sombra enorme hacia afuera oscurece todo lo que queda fuera de él. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] ring-2 ring-white/80" />
        </div>

        {/* La misma foto, con el mismo estilo, en el tamaño del menú: así se verá en la barra. */}
        <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
          <div aria-hidden className="relative size-12 overflow-hidden rounded-full border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" draggable={false} style={estilo} />
          </div>
          En el menú
        </div>
      </div>

      <label className="flex max-w-64 items-center gap-3 text-sm">
        <span className="font-medium">Zoom</span>
        {/* accent-primary (CSS accent-color): el control nativo con el color principal del tema activo. */}
        <input type="range" min={1} max={ZOOM_MAXIMO} step={0.01} value={zoom} disabled={!tam}
               onChange={(e) => cambiarZoom(Number(e.target.value))} className="w-full accent-primary" />
      </label>
      <p className="text-sm text-muted-foreground">Arrastra la foto para centrarla en el círculo.</p>

      {/* La zona que viaja con el formulario. Solo cuando la foto ya cargó: antes no hay tamaño real. lado = 1/zoom
          (fracción del lado corto). toFixed(5): de sobra para fotos de miles de píxeles, y un número corto. */}
      {tam && (
        <>
          <input type="hidden" name="recorte_x" value={pos.x.toFixed(5)} />
          <input type="hidden" name="recorte_y" value={pos.y.toFixed(5)} />
          <input type="hidden" name="recorte_lado" value={(1 / zoom).toFixed(5)} />
        </>
      )}
    </div>
  );
}
