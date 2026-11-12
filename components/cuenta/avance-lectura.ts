import type { LibroLeido } from "@/lib/data/lectura";

// RN-88, RN-90: el avance de un libro en palabras y, si se puede, en porcentaje (para la barra). Lo usan la lista y el
// detalle de "Mis lecturas". Sin "use client" ni "server-only": funciones puras, sirven en los dos lados.
// - En línea (EPUB/PDF): la fracción que guarda el latido.
// - En papel: la página que informó el lector; en % solo si el catálogo tiene el número de páginas.
// La barra muestra el MAYOR de los dos (lo más lejos que llegó, sin importar el formato).
type Avance = Pick<LibroLeido, "avance_digital" | "pagina_fisica" | "paginas">;

export function porcentajeDeAvance(l: Avance): number | null {
  const digital = l.avance_digital === null ? null : Math.round(l.avance_digital * 100);
  const papel = l.pagina_fisica !== null && l.paginas ? Math.min(100, Math.round((l.pagina_fisica / l.paginas) * 100)) : null;
  if (digital === null) return papel;
  if (papel === null) return digital;
  return Math.max(digital, papel);
}

// Las partes del avance, cada una en su frase: ["En línea: 62 %", "En papel: página 80 de 471"].
export function partesDeAvance(l: Avance): string[] {
  const partes: string[] = [];
  if (l.avance_digital !== null) partes.push(`En línea: ${Math.round(l.avance_digital * 100)} %`);
  if (l.pagina_fisica !== null) partes.push(`En papel: página ${l.pagina_fisica}${l.paginas ? ` de ${l.paginas}` : ""}`);
  return partes;
}
