"use client";

import { useSyncExternalStore } from "react";

// Preferencias del visor que solo valen en ESTE navegador (barra oculta, tamaño de letra, columnas): van en localStorage,
// no en la BD. Son comodidades: si localStorage falla (ventana privada, almacenamiento bloqueado), se usa el valor por
// defecto o el último elegido en esta pestaña, y el visor sigue funcionando.
//
// useSyncExternalStore y no useState + useEffect: localStorage es un "almacén externo" a React. Este hook lo lee en
// cada render con getSnapshot y vuelve a renderizar cuando avisamos de un cambio. El tercer argumento (getServerSnapshot)
// es el valor del SERVIDOR, que no tiene localStorage: React lo usa en el HTML inicial y al hidratar, y después pasa al
// valor real sin el aviso de "el HTML no coincide".

const respaldo = new Map<string, string>(); // lo elegido en esta pestaña, por si localStorage falla
const oyentes = new Set<() => void>();

function leer(clave: string): string | null {
  try {
    const valor = localStorage.getItem(clave);
    if (valor !== null) return valor;
  } catch {
    // almacenamiento bloqueado: se usa el respaldo
  }
  return respaldo.get(clave) ?? null;
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  window.addEventListener("storage", avisar); // otra pestaña cambió la preferencia
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

// `validar` convierte el texto guardado al tipo esperado, o devuelve null si no sirve (valor viejo o manipulado):
// entonces vale `porDefecto`.
export function usePreferencia<T extends string>(clave: string, porDefecto: T, validar: (valor: string) => T | null) {
  const valor = useSyncExternalStore(
    suscribir,
    () => { const v = leer(clave); return (v !== null && validar(v)) || porDefecto; },
    () => porDefecto,
  );
  function cambiar(nuevo: T) {
    respaldo.set(clave, nuevo);
    try {
      localStorage.setItem(clave, nuevo);
    } catch {
      try { localStorage.removeItem(clave); } catch { /* sin almacenamiento: queda el respaldo */ }
    }
    oyentes.forEach((avisar) => avisar());
  }
  return [valor, cambiar] as const;
}
