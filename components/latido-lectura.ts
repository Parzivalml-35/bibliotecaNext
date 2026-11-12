"use client";

import { useCallback, useEffect, useRef } from "react";

// RN-88: el latido del visor, del lado del navegador (la ruta que lo recibe es app/leer/[isbn]/latido/route.ts).
// Lo usan los dos visores (EPUB y PDF): cada uno solo dice DÓNDE va el lector; cuándo y cómo avisar se decide aquí.
//
//  - Cada `segundos`, si la pestaña está VISIBLE y el lector está ACTIVO, avisa con fetch. Una pestaña en segundo plano
//    no suma tiempo: por eso el intervalo pregunta document.visibilityState en cada vuelta.
//  - Inactividad (2026-11-12): sin interacción durante `minutosInactividad` (pasar página, mouse, teclado, rueda,
//    pantalla táctil), deja de avisar. La siguiente interacción reanuda los avisos, y el primero lleva `nueva: true`:
//    el servidor empieza otra sesión (si extendiera la anterior, el rato inactivo se sumaría a su duración).
//  - Al SALIR (cambiar de pestaña, minimizar, cerrar, navegar a otra página de la app) guarda la posición con
//    navigator.sendBeacon: el navegador entrega ese POST aunque la página se esté cerrando (un fetch normal se cancela).
//    Solo si la posición cambió desde el último aviso: abrir el libro y cerrarlo sin moverse no crea una sesión vacía.
//  - Silencioso: si un aviso falla (sin red, sesión vencida), no se muestra nada; el siguiente lo intenta otra vez.
//
// Devuelve marcarActividad: lo que pasa DENTRO del libro (el iframe de un capítulo EPUB) no llega a los eventos de
// esta página, así que el visor lo reporta llamándola.

export type PosicionLatido =
  | { formato: "epub"; cfi: string; fraccion: number }
  | { formato: "pdf"; pagina: number; fraccion: number };

// Los límites del latido, de configuracion (C-04): la página los lee y los pasa al visor.
export type Latido = { segundos: number; minutosInactividad: number };

// Lo que cuenta como "el lector está ahí", en esta página (fuera del libro). passive: no frenan el desplazamiento.
const EVENTOS_ACTIVIDAD = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

export function useLatidoLectura(
  isbn: string,
  { segundos, minutosInactividad }: Latido,
  posicion: PosicionLatido | null,
) {
  // Refs y no estado: cambiar de página o mover el mouse no debe volver a dibujar nada ni reiniciar el reloj; el reloj
  // y los avisos de salida leen el valor más reciente cuando lo necesitan.
  const actual = useRef<string | null>(null);
  const ultimaEnviada = useRef<string | null>(null);
  const ultimaActividad = useRef(0); // performance.now() de la última interacción (0 = aún no se montó)
  const volvioDeInactividad = useRef(false); // el próximo aviso pide sesión nueva

  // useCallback: la misma función siempre (el motor EPUB la guarda y la llama desde el iframe).
  const marcarActividad = useCallback(() => {
    ultimaActividad.current = performance.now();
  }, []);

  useEffect(() => {
    actual.current = posicion ? JSON.stringify(posicion) : null;
    // La PRIMERA posición conocida (la de apertura, que puede venir de la BD) cuenta como "ya enviada": si el lector
    // no se mueve, salir no avisa.
    if (ultimaEnviada.current === null) ultimaEnviada.current = actual.current;
    else marcarActividad(); // cambiar de página es actividad (con el teclado o la rueda dentro del libro, por ejemplo)
  }, [posicion, marcarActividad]);

  useEffect(() => {
    if (segundos <= 0) return;
    // encodeURIComponent: el isbn viene de la URL (ya validado en el servidor, pero no cuesta nada).
    const url = `/leer/${encodeURIComponent(isbn)}/latido`;
    const limiteInactivo = minutosInactividad * 60_000;
    ultimaActividad.current = performance.now(); // abrir el libro es actividad

    // El cuerpo del aviso: la posición, más `nueva` si se vuelve de una inactividad (y entonces se consume).
    function cuerpoConSesion(posicionTexto: string) {
      if (!volvioDeInactividad.current) return posicionTexto;
      volvioDeInactividad.current = false;
      return JSON.stringify({ ...JSON.parse(posicionTexto), nueva: true });
    }

    function latir() {
      const pos = actual.current;
      if (!pos || document.visibilityState !== "visible") return;
      if (performance.now() - ultimaActividad.current > limiteInactivo) {
        volvioDeInactividad.current = true; // nadie: no se avisa, y al volver será otra sesión
        return;
      }
      ultimaEnviada.current = pos;
      // keepalive: si justo se cierra la página, el navegador termina de enviarlo. same-origin: la ruta exige
      // Sec-Fetch-Site: same-origin y la cookie de sesión.
      void fetch(url, { method: "POST", body: cuerpoConSesion(pos), keepalive: true, credentials: "same-origin",
                        headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
    function alSalir() {
      const pos = actual.current;
      if (!pos || pos === ultimaEnviada.current) return;
      ultimaEnviada.current = pos;
      navigator.sendBeacon(url, new Blob([cuerpoConSesion(pos)], { type: "application/json" }));
    }
    // "hidden" llega al cambiar de pestaña, minimizar o cerrar (en el celular, a veces es el ÚLTIMO evento que llega:
    // pagehide no siempre). pagehide cubre el resto. Si llegan los dos, el segundo no envía nada (misma posición).
    const alCambiarVisibilidad = () => { if (document.visibilityState === "hidden") alSalir(); };

    const reloj = setInterval(latir, segundos * 1000);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("pagehide", alSalir);
    for (const tipo of EVENTOS_ACTIVIDAD) window.addEventListener(tipo, marcarActividad, { passive: true });
    return () => {
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("pagehide", alSalir);
      for (const tipo of EVENTOS_ACTIVIDAD) window.removeEventListener(tipo, marcarActividad);
      // Desmontar = salir del visor sin cerrar la página (un <Link> como "← Volver": navegación del cliente, sin
      // pagehide). También aquí se guarda la posición.
      alSalir();
    };
  }, [isbn, segundos, minutosInactividad, marcarActividad]);

  return marcarActividad;
}
