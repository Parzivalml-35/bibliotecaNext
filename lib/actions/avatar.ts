"use server";

import { redirect } from "next/navigation";
import { operar, texto } from "@/lib/actions/reglas";
import { esEstiloAvatar, NOMBRES_ESTILO } from "@/lib/avatar";
import {
  bloquearFotoDeAvatar,
  cambiarEstiloDeAvatar,
  cambiarFotoDeAvatar,
  maxKbAvatar,
  nuevaSemillaDeAvatar,
} from "@/lib/data/avatar";
import type { EstadoFormulario } from "@/lib/definitions";
import { borrarFoto, guardarFoto, procesarFoto } from "@/lib/foto-avatar";
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

// RN-82: subir una foto. El orden importa, porque el disco no entra en la transacción de MySQL:
//   1. procesar (validar y volver a codificar) fuera de la transacción: es lo lento, y no debe tener la fila bloqueada;
//   2. escribir el archivo nuevo;
//   3. transacción: bloquear la fila, leer la clave anterior y guardar la nueva;
//   4. si la transacción falló, borrar el archivo nuevo (nadie lo nombra); si salió bien, borrar el anterior.
// Así nunca hay una cuenta que nombre un archivo inexistente: en el peor caso (se cae el servidor entre 2 y 3, o entre
// el COMMIT y el borrado) queda un archivo huérfano, que ocupa espacio pero no se sirve a nadie.
export async function subirFotoAvatar(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  // datos.get() devuelve string | File | null: un campo de texto con el mismo nombre llegaría como string.
  // Un <input type="file"> sin elegir nada envía un File vacío (size 0, nombre "").
  const archivo = datos.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige una foto." };

  const resultado = await procesarFoto(archivo, await maxKbAvatar());
  if ("error" in resultado) return { error: resultado.error };

  let clave: string;
  try {
    clave = await guardarFoto(resultado.webp);
  } catch (error) {
    console.error("No se pudo guardar la foto de avatar:", error);
    return { error: "No se pudo guardar la foto. Inténtalo de nuevo." };
  }

  // Un objeto y no un `let anterior`: TypeScript no ve las asignaciones hechas dentro de una función que se pasa a
  // otra (la de operar), y después de ella seguiría creyendo que la variable vale null.
  const cambio = { anterior: null as string | null };
  const estado = await operar({}, async (conexion) => {
    cambio.anterior = await bloquearFotoDeAvatar(conexion, usuario.idCuenta);
    await cambiarFotoDeAvatar(conexion, usuario.idCuenta, clave);
    return "Listo: tu avatar ahora es tu foto.";
  }, ["/"]);

  if (estado.error) await borrarFoto(clave); // ROLLBACK: la BD sigue con la anterior
  else if (cambio.anterior) await borrarFoto(cambio.anterior); // RN-82: la nueva reemplaza a la anterior, que se borra
  return estado;
}

// RN-81 y RN-82: volver al avatar generado cuando quiera. Sin parámetros, como generarOtroAvatar.
export async function quitarFotoAvatar(): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");

  const cambio = { anterior: null as string | null };
  const estado = await operar({}, async (conexion) => {
    cambio.anterior = await bloquearFotoDeAvatar(conexion, usuario.idCuenta);
    if (!cambio.anterior) return "Ya usas tu avatar generado.";
    await cambiarFotoDeAvatar(conexion, usuario.idCuenta, null);
    return "Listo: volviste a tu avatar generado.";
  }, ["/"]);

  if (!estado.error && cambio.anterior) await borrarFoto(cambio.anterior);
  return estado;
}
