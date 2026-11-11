"use server";

import { guardarTemaDeCuenta } from "@/lib/data/sesiones";
import { esTemaBase } from "@/lib/tema";
import { obtenerUsuario } from "@/lib/sesion";

// DI-04 (R7h): guarda en la cuenta el tema que la persona acaba de elegir (botón sol/luna, lámpara o /cuenta/perfil).
// La cookie sigue mandando en cada equipo y ya la escribió el navegador; la cuenta es la copia que viaja a otro equipo
// (se aplica al iniciar sesión, ver iniciarSesion).
//
// No usa operar() ni revalidatePath: no cambia nada que una página muestre (el tema lo pintan los atributos de <html>),
// y volver a dibujar la página por un clic en la lámpara sería trabajo inútil. Tampoco escribe cookies aquí: según la
// guía de cookies() de Next, una Server Action que escribe cookies hace que se vuelva a dibujar la página.
//
// Recibe `unknown` y no Preferencia: una Server Action es un endpoint público y el tipo de TypeScript no existe en la
// petición; se valida la forma a mano. Devuelve true si quedó guardado (false sin sesión o con datos inválidos).
export async function guardarTema(preferencia: unknown): Promise<boolean> {
  const usuario = await obtenerUsuario();
  if (!usuario) return false; // sin sesión: el tema solo vive en las cookies de este equipo

  if (typeof preferencia !== "object" || preferencia === null) return false;
  const { base, lampara } = preferencia as Record<string, unknown>;
  if (!(base === null || esTemaBase(base)) || typeof lampara !== "boolean") return false;

  try {
    await guardarTemaDeCuenta(usuario.idCuenta, base, lampara);
    return true;
  } catch (error) {
    // El cambio visual ya ocurrió y la cookie lo recuerda en este equipo: un fallo aquí no se le muestra a nadie.
    console.error("No se pudo guardar el tema en la cuenta:", error);
    return false;
  }
}
