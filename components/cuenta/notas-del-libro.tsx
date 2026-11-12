"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PanelNotas, type PestanaNotas } from "@/components/visor-epub/panel-notas";
import { borrarNota, borrarResaltado, crearNota, editarNota } from "@/lib/actions/lectura";
import type { Anotacion, NotaLibre } from "@/lib/lectura";

// "Mis lecturas", columna de lo tuyo (RN-86, RN-87, RN-89): el MISMO panel del visor (PanelNotas), con el estado de
// las notas aquí, como lo tiene el visor. Las Server Actions son las mismas; el servidor vuelve a comprobar todo.
// - Notas libres: se pueden crear y editar en cualquier libro que tuviste (RN-86), sin ubicación (no hay visor).
// - "Ir al pasaje": solo con acceso vigente (RN-87). Es navegación COMPLETA (location.assign, como un <a>): a /leer se
//   entra así para que llegue su CSP (RN-84).
// - router.refresh() después de cada cambio: vuelve a pedir la página al servidor para que la lista de libros (en el
//   layout) refleje la nueva "última actividad". El estado de aquí no se pierde (React mezcla el resultado).
export function NotasDelLibro({ isbn, notas: iniciales, resaltados: resaltadosIniciales, maxNota, conAcceso }: {
  isbn: string;
  notas: NotaLibre[];
  resaltados: Anotacion[];
  maxNota: number;
  conAcceso: boolean;
}) {
  const router = useRouter();
  const [pestana, setPestana] = useState<PestanaNotas>("notas");
  const [notas, setNotas] = useState(iniciales);
  const [resaltados, setResaltados] = useState(resaltadosIniciales);

  async function alCrear(texto: string) {
    const r = await crearNota(isbn, { texto }); // sin cfi ni capítulo: escrita fuera del libro
    if (!r.ok) return r.error;
    const ahora = new Date();
    const dos = (n: number) => String(n).padStart(2, "0");
    const fecha = `${dos(ahora.getDate())}/${dos(ahora.getMonth() + 1)}/${ahora.getFullYear()} ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
    setNotas((l) => [{ id_nota_libre: r.valor.id, texto: texto.trim(), cfi: null, capitulo: null, fecha_creacion: fecha, editada: 0 }, ...l]);
    router.refresh();
    return null;
  }
  async function alEditar(id: number, texto: string) {
    const r = await editarNota(id, texto);
    if (!r.ok) return r.error;
    setNotas((l) => l.map((n) => (n.id_nota_libre === id ? { ...n, texto: texto.trim(), editada: 1 } : n)));
    router.refresh();
    return null;
  }
  async function alBorrarNota(id: number) {
    const r = await borrarNota(id);
    if (!r.ok) return r.error;
    setNotas((l) => l.filter((n) => n.id_nota_libre !== id));
    router.refresh();
    return null;
  }
  async function alBorrarResaltado(id: number) {
    const r = await borrarResaltado(id);
    if (!r.ok) return r.error;
    setResaltados((l) => l.filter((a) => a.id_anotacion !== id));
    router.refresh();
    return null;
  }

  return (
    <PanelNotas pestana={pestana} alCambiarPestana={setPestana} notas={notas} resaltados={resaltados} maxNota={maxNota}
                capituloActual={null} pedidoNueva={0} alCrear={alCrear} alEditar={alEditar} alBorrarNota={alBorrarNota}
                alBorrarResaltado={alBorrarResaltado}
                // RN-84: navegación COMPLETA a propósito (router.push haría una navegación del cliente y /leer quedaría
                // sin su CSP). La regla de ESLint sugiere router.push para páginas internas; aquí no aplica.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                alIr={conAcceso ? (cfi) => window.location.assign(`/leer/${isbn}?ir=${encodeURIComponent(cfi)}`) : undefined}
                ayudaNueva="Una nota sobre el libro, sin un lugar del texto. Las que escribes leyendo en línea guardan dónde estabas." />
  );
}
