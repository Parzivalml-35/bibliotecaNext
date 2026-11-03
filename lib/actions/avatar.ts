"use server";

import { redirect } from "next/navigation";
import { operar, texto } from "@/lib/actions/reglas";
import { esEstiloAvatar, NOMBRES_ESTILO } from "@/lib/avatar";
import { cambiarEstiloDeAvatar, nuevaSemillaDeAvatar } from "@/lib/data/avatar";
import type { EstadoFormulario } from "@/lib/definitions";
import { obtenerUsuario } from "@/lib/sesion";

// RN-81: el dueño de la cuenta cambia su avatar generado. obtenerUsuario y no exigirLector: el avatar es de la CUENTA,
// y /panel/perfil (R7i) usará las mismas acciones para un empleado. El id de la cuenta sale siempre de la sesión.
// Ruta "/" con "layout" (en operar): el avatar está en el menú de TODAS las páginas, así que se invalidan todas.

// Sin parámetros: useActionState le pasa (estado, datos), pero no necesita ninguno, y en TypeScript una función que
// declara menos parámetros sigue sirviendo donde se esperan más.
export async function generarOtroAvatar(): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  return operar({}, async (conexion) => {
    await nuevaSemillaDeAvatar(conexion, usuario.idCuenta);
    return "Listo: tienes un avatar nuevo.";
  }, ["/"]);
}

export async function elegirEstiloAvatar(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  const estilo = texto(datos, "estilo");
  // Lista permitida (RN-81: solo estilos CC0): la columna es VARCHAR, así que la BD aceptaría cualquier texto.
  if (!esEstiloAvatar(estilo)) return { error: "Elige uno de los estilos de la lista." };

  return operar({}, async (conexion) => {
    await cambiarEstiloDeAvatar(conexion, usuario.idCuenta, estilo);
    return `Listo: tu avatar ahora es de estilo ${NOMBRES_ESTILO[estilo]}.`;
  }, ["/"]);
}
