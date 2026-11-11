"use server";

import {
  actualizarAnotacion,
  borrarAnotacion,
  borrarNotaLibre,
  crearNotaLibre,
  editarNotaLibre,
  guardarAnotacion,
  libroDeAnotacion,
  libroDeNotaLibre,
  limitesDeLectura,
} from "@/lib/data/lectura";
import { obtenerAccesoDeLectura } from "@/lib/data/digital";
import { esIsbnValido } from "@/lib/isbn";
import { esCfi, esColorAnotacion, esEstiloAnotacion, largo, recortar } from "@/lib/lectura";
import { obtenerUsuario } from "@/lib/sesion";

// RN-85 a RN-87: lo que el lector escribe mientras lee (resaltados y notas libres). Las llama el visor EPUB (Client
// Component) con objetos simples, no con un <form>: devuelven un resultado y el visor actualiza lo que muestra.
//
// - Reciben `unknown`: una Server Action es un endpoint público; el tipo de TypeScript no viaja en la petición, así que
//   la forma se valida a mano (como guardarTema).
// - El lector sale SIEMPRE de la sesión (RN-87, RN-35); un id de anotación o nota ajeno se trata como inexistente.
// - Crear y editar exigen acceso vigente al título (RN-29); borrar no (RN-87: sin acceso se puede ver y borrar).
// - Sin revalidatePath: ninguna página del servidor muestra estos datos mientras se lee (el visor los tiene en estado).
//   "Mis lecturas" (R10-F) se dibuja en cada petición, así que siempre lee lo último.

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const SIN_SESION = "Tu sesión terminó. Vuelve a iniciar sesión para guardar.";
const SIN_ACCESO = "Ya no tienes este libro: puedes ver y borrar lo que escribiste, pero no crear ni editar.";
const NO_ENCONTRADA = "No se encontró. Puede que ya la hayas borrado.";

function objeto(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function idValido(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

// El lector de la sesión con acceso VIGENTE al título (préstamo o compra). null en `lector` = sin sesión o sin perfil
// de lector; null en `idLibro` = sin acceso (o el título no existe: la respuesta es la misma).
async function lectorYAcceso(isbn: unknown): Promise<{ idLector: number | null; idLibro: number | null }> {
  const usuario = await obtenerUsuario();
  if (!usuario?.lector) return { idLector: null, idLibro: null };
  if (typeof isbn !== "string" || !esIsbnValido(isbn)) return { idLector: usuario.lector.idLector, idLibro: null };
  const acceso = await obtenerAccesoDeLectura(usuario.lector.idLector, isbn);
  return { idLector: usuario.lector.idLector, idLibro: acceso?.id_libro ?? null };
}

// La nota: texto sin espacios de más; vacía = sin nota (null). Más larga que el límite = error (no se recorta: es lo
// que el lector escribió, y recortarlo sin avisar perdería parte).
function notaDe(v: unknown, maximo: number): { nota: string | null } | { error: string } {
  if (v === undefined || v === null) return { nota: null };
  if (typeof v !== "string") return { error: "La nota no es válida." };
  const limpia = v.trim();
  if (limpia === "") return { nota: null };
  if (largo(limpia) > maximo) return { error: `La nota puede tener hasta ${maximo} caracteres (tiene ${largo(limpia)}).` };
  return { nota: limpia };
}

// Envuelve el trabajo con la sesión: un error inesperado se registra en el servidor y el lector ve un mensaje genérico.
async function intentar<T>(trabajo: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await trabajo();
  } catch (error) {
    console.error("Error al guardar una anotación o nota:", error);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

// ---------------------------------------------------------------------
// Resaltados (RN-85)
// ---------------------------------------------------------------------

// Marca un fragmento. Si ya estaba marcado, cambia su color y su estilo (y la nota, si llega una).
export async function guardarResaltado(isbn: unknown, datos: unknown): Promise<Resultado<{ id: number; texto_citado: string }>> {
  return intentar(async () => {
    const { idLector, idLibro } = await lectorYAcceso(isbn);
    if (!idLector) return { ok: false, error: SIN_SESION };
    if (!idLibro) return { ok: false, error: SIN_ACCESO };

    const d = objeto(datos);
    if (!d || !esCfi(d.cfi) || typeof d.texto !== "string" || !esColorAnotacion(d.color) || !esEstiloAnotacion(d.estilo)) {
      return { ok: false, error: "No se pudo leer el fragmento seleccionado." };
    }
    const texto = d.texto.replace(/\s+/g, " ").trim(); // la selección trae saltos de línea y espacios del maquetado
    if (texto === "") return { ok: false, error: "Selecciona un fragmento con texto." };

    const limites = await limitesDeLectura();
    const n = notaDe(d.nota, limites.max_caracteres_nota);
    if ("error" in n) return { ok: false, error: n.error };
    // RN-85: la cita se RECORTA (es una copia del libro, no algo que el lector escribió).
    const texto_citado = recortar(texto, limites.max_caracteres_cita);

    const id = await guardarAnotacion(idLector, idLibro, { cfi: d.cfi, texto_citado, color: d.color, estilo: d.estilo, nota: n.nota });
    return { ok: true, valor: { id, texto_citado } };
  });
}

// Cambia el color, el estilo o la nota de un resaltado propio. Exige acceso vigente a SU título.
export async function actualizarResaltado(id: unknown, datos: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    const idLector = usuario.lector.idLector;
    const d = objeto(datos);
    if (!idValido(id) || !d || !esColorAnotacion(d.color) || !esEstiloAnotacion(d.estilo)) {
      return { ok: false, error: "Datos no válidos." };
    }
    const libro = await libroDeAnotacion(idLector, id);
    if (!libro) return { ok: false, error: NO_ENCONTRADA };
    if (!(await obtenerAccesoDeLectura(idLector, libro.isbn))) return { ok: false, error: SIN_ACCESO };

    const n = notaDe(d.nota, (await limitesDeLectura()).max_caracteres_nota);
    if ("error" in n) return { ok: false, error: n.error };
    const ok = await actualizarAnotacion(idLector, id, { color: d.color, estilo: d.estilo, nota: n.nota });
    return ok ? { ok: true, valor: null } : { ok: false, error: NO_ENCONTRADA };
  });
}

// RN-87: borrar no exige acceso (sin el libro se puede ver y borrar).
export async function borrarResaltado(id: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    if (!idValido(id)) return { ok: false, error: "Datos no válidos." };
    const ok = await borrarAnotacion(usuario.lector.idLector, id);
    return ok ? { ok: true, valor: null } : { ok: false, error: NO_ENCONTRADA };
  });
}

// ---------------------------------------------------------------------
// Notas libres (RN-86)
// ---------------------------------------------------------------------

// Una nota nueva. `cfi` y `capitulo`: dónde estaba el lector al escribirla (opcionales; si llegan mal, se ignoran:
// la nota vale igual, solo que sin "ir a donde la escribí").
export async function crearNota(isbn: unknown, datos: unknown): Promise<Resultado<{ id: number }>> {
  return intentar(async () => {
    const { idLector, idLibro } = await lectorYAcceso(isbn);
    if (!idLector) return { ok: false, error: SIN_SESION };
    if (!idLibro) return { ok: false, error: SIN_ACCESO };
    const d = objeto(datos);
    if (!d) return { ok: false, error: "Datos no válidos." };

    const n = notaDe(d.texto, (await limitesDeLectura()).max_caracteres_nota);
    if ("error" in n) return { ok: false, error: n.error };
    if (n.nota === null) return { ok: false, error: "Escribe algo en la nota." };
    const cfi = esCfi(d.cfi) ? d.cfi : null;
    const capitulo = typeof d.capitulo === "string" && d.capitulo.trim() ? recortar(d.capitulo.trim(), 255) : null;

    const id = await crearNotaLibre(idLector, idLibro, { texto: n.nota, cfi, capitulo });
    return { ok: true, valor: { id } };
  });
}

export async function editarNota(id: unknown, texto: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    const idLector = usuario.lector.idLector;
    if (!idValido(id)) return { ok: false, error: "Datos no válidos." };
    const libro = await libroDeNotaLibre(idLector, id);
    if (!libro) return { ok: false, error: NO_ENCONTRADA };
    if (!(await obtenerAccesoDeLectura(idLector, libro.isbn))) return { ok: false, error: SIN_ACCESO };

    const n = notaDe(texto, (await limitesDeLectura()).max_caracteres_nota);
    if ("error" in n) return { ok: false, error: n.error };
    if (n.nota === null) return { ok: false, error: "La nota no puede quedar vacía. Si ya no la quieres, bórrala." };
    const ok = await editarNotaLibre(idLector, id, n.nota);
    return ok ? { ok: true, valor: null } : { ok: false, error: NO_ENCONTRADA };
  });
}

export async function borrarNota(id: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    if (!idValido(id)) return { ok: false, error: "Datos no válidos." };
    const ok = await borrarNotaLibre(usuario.lector.idLector, id);
    return ok ? { ok: true, valor: null } : { ok: false, error: NO_ENCONTRADA };
  });
}
