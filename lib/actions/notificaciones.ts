"use server";

import { refresh } from "next/cache";
import { abrirNotificacionDeCuenta, marcarTodasLeidasDeCuenta } from "@/lib/data/notificaciones";
import { obtenerUsuario, rutaInterna } from "@/lib/sesion";

// RN-91: lo que hace la campana. La llaman los botones del menú (Client Component) con valores simples y reciben un
// resultado, como las acciones de lectura.
//
// - Reciben `unknown`: una Server Action es un endpoint público; la forma se valida a mano.
// - La cuenta sale SIEMPRE de la sesión (RN-35); un id de otra cuenta se trata como inexistente.
// - obtenerUsuario y no exigirLector: las notificaciones son de la cuenta (RN-31), también de un empleado.
// - refresh() (next/cache, solo en Server Actions): vuelve a pedir los Server Components de la página actual, así el
//   número de la campana (que dibuja el layout en el servidor) baja sin recargar.

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const SIN_SESION = "Tu sesión terminó. Vuelve a iniciar sesión.";

export async function abrirNotificacion(id: unknown): Promise<Resultado<string>> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: SIN_SESION };
  if (!Number.isInteger(id) || (id as number) < 1) return { ok: false, error: "Datos no válidos." };

  const enlace = await abrirNotificacionDeCuenta(usuario.idCuenta, id as number);
  if (enlace === null) return { ok: false, error: "Ese aviso ya no está disponible." };
  // Defensa en profundidad: el CHECK de la BD ya exige una ruta interna, pero quien navega con este valor es el
  // navegador (router.push); se valida otra vez con la misma regla del login (RN-83).
  const ruta = rutaInterna(enlace);
  if (ruta === null) return { ok: false, error: "Ese aviso ya no está disponible." };
  refresh();
  return { ok: true, valor: ruta };
}

export async function marcarTodasLeidas(): Promise<Resultado<number>> {
  const usuario = await obtenerUsuario();
  if (!usuario) return { ok: false, error: SIN_SESION };
  const cuantas = await marcarTodasLeidasDeCuenta(usuario.idCuenta);
  refresh();
  return { ok: true, valor: cuantas };
}
