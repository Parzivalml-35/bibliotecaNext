"use client";

import { useEffect, useRef } from "react";

// RN-88: el latido del visor, del lado del navegador (la ruta que lo recibe es app/leer/[isbn]/latido/route.ts).
// Lo usan los dos visores (EPUB y PDF): cada uno solo dice DÓNDE va el lector; cuándo y cómo avisar se decide aquí.
//
//  - Cada `segundos`, si la pestaña está VISIBLE, avisa con fetch. Una pestaña en segundo plano no suma tiempo de
//    lectura: por eso el intervalo pregunta document.visibilityState en cada vuelta.
//  - Al SALIR (cambiar de pestaña, minimizar, cerrar, navegar a otra página de la app) guarda la posición con
//    navigator.sendBeacon: el navegador entrega ese POST aunque la página se esté cerrando (un fetch normal se cancela).
//    Solo si la posición cambió desde el último aviso: abrir el libro y cerrarlo sin moverse no crea una sesión vacía.
//  - Silencioso: si un aviso falla (sin red, sesión vencida), no se muestra nada; el siguiente lo intenta otra vez.

export type PosicionLatido =
  | { formato: "epub"; cfi: string; fraccion: number }
  | { formato: "pdf"; pagina: number; fraccion: number };

export function useLatidoLectura(isbn: string, segundos: number, posicion: PosicionLatido | null) {
  // Refs y no estado: cambiar de página no debe volver a dibujar nada ni reiniciar el reloj; el reloj y los avisos de
  // salida leen el valor más reciente cuando lo necesitan.
  const actual = useRef<string | null>(null);
  const ultimaEnviada = useRef<string | null>(null);

  useEffect(() => {
    actual.current = posicion ? JSON.stringify(posicion) : null;
    // La PRIMERA posición conocida (la de apertura, que puede venir de la BD) cuenta como "ya enviada": si el lector
    // no se mueve, salir no avisa.
    if (ultimaEnviada.current === null) ultimaEnviada.current = actual.current;
  }, [posicion]);

  useEffect(() => {
    if (segundos <= 0) return;
    // encodeURIComponent: el isbn viene de la URL (ya validado en el servidor, pero no cuesta nada).
    const url = `/leer/${encodeURIComponent(isbn)}/latido`;

    function latir() {
      const cuerpo = actual.current;
      if (!cuerpo || document.visibilityState !== "visible") return;
      ultimaEnviada.current = cuerpo;
      // keepalive: si justo se cierra la página, el navegador termina de enviarlo. same-origin: la ruta exige
      // Sec-Fetch-Site: same-origin y la cookie de sesión.
      void fetch(url, { method: "POST", body: cuerpo, keepalive: true, credentials: "same-origin",
                        headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
    function alSalir() {
      const cuerpo = actual.current;
      if (!cuerpo || cuerpo === ultimaEnviada.current) return;
      ultimaEnviada.current = cuerpo;
      navigator.sendBeacon(url, new Blob([cuerpo], { type: "application/json" }));
    }
    // "hidden" llega al cambiar de pestaña, minimizar o cerrar (en el celular, a veces es el ÚLTIMO evento que llega:
    // pagehide no siempre). pagehide cubre el resto. Si llegan los dos, el segundo no envía nada (misma posición).
    const alCambiarVisibilidad = () => { if (document.visibilityState === "hidden") alSalir(); };

    const reloj = setInterval(latir, segundos * 1000);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("pagehide", alSalir);
    return () => {
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("pagehide", alSalir);
      // Desmontar = salir del visor sin cerrar la página (un <Link> como "← Volver": navegación del cliente, sin
      // pagehide). También aquí se guarda la posición.
      alSalir();
    };
  }, [isbn, segundos]);
}
