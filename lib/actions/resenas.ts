"use server";

import { refresh, revalidatePath } from "next/cache";
import { enTransaccion } from "@/lib/db";
import { obtenerLibroPorIsbn } from "@/lib/data/libros";
import {
  borrarResenaDeLector,
  guardarResenaDeLector,
  maxCaracteresResena,
  reportarResenaDeLector,
} from "@/lib/data/resenas";
import { esIsbnValido } from "@/lib/isbn";
import { largo } from "@/lib/lectura";
import { esMotivoReporte, MAX_DETALLE_REPORTE } from "@/lib/resenas";
import { obtenerUsuario } from "@/lib/sesion";

// RN-94 y RN-95: escribir, editar, borrar y reportar reseñas. Las llaman formularios de cliente (la ficha del libro y
// la tarjeta "Tu opinión" de "Mis lecturas") con valores simples y reciben un resultado.
//
// - Reciben `unknown`: una Server Action es un endpoint público; la forma se valida a mano.
// - El lector sale SIEMPRE de la sesión (RN-35); la reseña que se edita o borra es "la del lector en ese libro", así
//   que no hay un id de reseña que se pueda cambiar por el de otro.
// - Escribir y reportar piden la cuenta VERIFICADA (RN-94, RN-95); no hace falta haber tenido el libro (la insignia lo
//   dice, y la calcula el servidor). Borrar la propia, no: si su correo dejó de estar verificado, igual puede quitarla.
// - revalidatePath de la ficha (otras personas ven el promedio nuevo) y refresh() para la página desde la que se
//   llamó (la ficha o "Mis lecturas"): las dos vuelven a pedir sus Server Components.

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const SIN_SESION = "Tu sesión terminó. Vuelve a iniciar sesión.";
const SIN_VERIFICAR = "Verifica tu correo para publicar reseñas.";

async function intentar<T>(trabajo: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await trabajo();
  } catch (error) {
    // Dos reportes a la vez de la misma persona: el UNIQUE frena el segundo.
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return { ok: false, error: "Ya reportaste esta reseña." };
    console.error("Error en una reseña:", error);
    return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." };
  }
}

async function libroDe(isbn: unknown) {
  if (typeof isbn !== "string" || !esIsbnValido(isbn)) return null;
  return obtenerLibroPorIsbn(isbn);
}

export async function guardarResena(isbn: unknown, datos: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    if (!usuario.lector.verificada) return { ok: false, error: SIN_VERIFICAR };
    const libro = await libroDe(isbn);
    if (!libro) return { ok: false, error: "Datos no válidos." };

    const d = (datos ?? {}) as { estrellas?: unknown; recomienda?: unknown; texto?: unknown };
    if (!Number.isInteger(d.estrellas) || (d.estrellas as number) < 1 || (d.estrellas as number) > 5) {
      return { ok: false, error: "Elige de 1 a 5 estrellas." };
    }
    if (typeof d.recomienda !== "boolean") return { ok: false, error: "Di si lo recomendarías." };
    if (d.texto !== null && d.texto !== undefined && typeof d.texto !== "string") return { ok: false, error: "Datos no válidos." };
    // Texto en blanco = sin texto (NULL): el CHECK ck_resena_texto no acepta uno vacío.
    const texto = typeof d.texto === "string" && d.texto.trim() !== "" ? d.texto.trim() : null;
    const maximo = await maxCaracteresResena(); // C-04: el largo sale de configuracion
    if (texto !== null && largo(texto) > maximo) return { ok: false, error: `La reseña puede tener hasta ${maximo} caracteres.` };

    await enTransaccion((conexion) => guardarResenaDeLector(conexion, usuario.lector!.idLector, libro.id_libro,
      { estrellas: d.estrellas as number, recomienda: d.recomienda as boolean, texto }));
    revalidatePath(`/libros/${libro.isbn}`);
    refresh();
    return { ok: true, valor: null };
  });
}

export async function borrarResena(isbn: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    const libro = await libroDe(isbn);
    if (!libro) return { ok: false, error: "Datos no válidos." };
    if (!(await borrarResenaDeLector(usuario.lector.idLector, libro.id_libro))) {
      return { ok: false, error: "No tienes una reseña de este libro." };
    }
    revalidatePath(`/libros/${libro.isbn}`);
    refresh();
    return { ok: true, valor: null };
  });
}

// RN-95: reportar una reseña ajena y visible, una vez por persona. El mensaje no dice si existe una oculta: para quien
// reporta, una reseña oculta o inexistente es lo mismo.
export async function reportarResena(idResena: unknown, motivo: unknown, detalle: unknown): Promise<Resultado<null>> {
  return intentar(async () => {
    const usuario = await obtenerUsuario();
    if (!usuario?.lector) return { ok: false, error: SIN_SESION };
    if (!usuario.lector.verificada) return { ok: false, error: "Verifica tu correo para reportar reseñas." };
    if (!Number.isInteger(idResena) || (idResena as number) < 1 || !esMotivoReporte(motivo)) {
      return { ok: false, error: "Elige un motivo." };
    }
    if (detalle !== null && detalle !== undefined && typeof detalle !== "string") return { ok: false, error: "Datos no válidos." };
    const texto = typeof detalle === "string" && detalle.trim() !== "" ? detalle.trim() : null;
    if (texto !== null && largo(texto) > MAX_DETALLE_REPORTE) {
      return { ok: false, error: `El detalle puede tener hasta ${MAX_DETALLE_REPORTE} caracteres.` };
    }

    const resultado = await enTransaccion((conexion) =>
      reportarResenaDeLector(conexion, usuario.lector!.idLector, idResena as number, motivo, texto));
    if (resultado === "no_existe") return { ok: false, error: "Esa reseña ya no está disponible." };
    if (resultado === "propia") return { ok: false, error: "No puedes reportar tu propia reseña." };
    refresh();
    return { ok: true, valor: null };
  });
}
