"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorDeRegla } from "@/lib/actions/reglas";
import { AYUDA_APODO, esApodoValido, normalizarApodo } from "@/lib/apodo";
import { enTransaccion } from "@/lib/db";
import { apodoOcupado, cambiarApodoDeCuenta, esApodoRepetido } from "@/lib/data/sesiones";
import type { EstadoFormulario } from "@/lib/definitions";
import { obtenerUsuario } from "@/lib/sesion";

// RN-92: el dueño de la cuenta cambia su apodo. obtenerUsuario y no exigirLector: el apodo es de la CUENTA (RN-31), así
// /panel/perfil usa la misma acción para un empleado. El id de la cuenta sale siempre de la sesión (RN-35).
//
// No usa operar() (lib/actions/reglas.ts) porque operar convierte cualquier error inesperado en un mensaje genérico, y
// aquí hay uno esperable: dos personas que eligen el mismo apodo a la vez pasan las dos la consulta previa, y el
// UNIQUE frena a la segunda con ER_DUP_ENTRY. Esa persona debe leer "ya está en uso", no "inténtalo de nuevo".
export async function cambiarApodo(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  const apodo = normalizarApodo(datos.get("apodo"));
  const valores = { apodo };
  if (!esApodoValido(apodo)) return { error: `Ese apodo no sirve. ${AYUDA_APODO}`, valores };
  if (apodo === usuario.apodo) return { exito: "Ese ya es tu apodo." };

  try {
    await enTransaccion(async (conexion) => {
      if (await apodoOcupado(conexion, apodo, usuario.idCuenta)) throw new ErrorDeRegla("Ese apodo ya está en uso. Elige otro.");
      await cambiarApodoDeCuenta(conexion, usuario.idCuenta, apodo);
    });
  } catch (error) {
    if (error instanceof ErrorDeRegla) return { error: error.message, valores };
    if (esApodoRepetido(error)) return { error: "Ese apodo ya está en uso. Elige otro.", valores };
    console.error("Error al cambiar el apodo:", error);
    return { error: "No se pudo cambiar el apodo. Inténtalo de nuevo.", valores };
  }
  // "/" con "layout": el apodo aparece en el menú de la cuenta, en todas las páginas (como el avatar).
  revalidatePath("/", "layout");
  return { exito: `Listo: ahora te ves como «${apodo}» en lo que publiques.` };
}
