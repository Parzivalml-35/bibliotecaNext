"use server";

import { redirect } from "next/navigation";
import { hashearContrasena, verificarContrasena } from "@/lib/contrasenas";
import { buscarCuentaPorCorreo } from "@/lib/data/sesiones";
import type { EstadoFormulario } from "@/lib/definitions";
import { cerrarSesion, crearSesion } from "@/lib/sesion";

// "use server" convierte CADA función exportada de este archivo en un endpoint al que cualquiera puede
// hacer POST, no solo nuestro formulario. Por eso se valida todo lo que llega y no se exportan ayudantes.

const ERROR_CREDENCIALES = "Correo o contraseña incorrectos.";

// Si el correo no existe, igual se ejecuta scrypt contra un hash cualquiera: sin esto la respuesta
// tardaría ~0 ms en vez de ~300 ms y el tiempo revelaría qué correos tienen cuenta.
let hashDeRelleno: Promise<string> | undefined;

// Firma que exige useActionState: (estado anterior, datos del formulario) => estado nuevo.
export async function iniciarSesion(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  // FormData.get devuelve string | File | null: se normaliza a texto antes de validar.
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const valores = { correo }; // la contraseña nunca vuelve al navegador

  if (!correo || !contrasena) return { error: "Escribe tu correo y tu contraseña.", valores };
  // Límites de tamaño: el correo cabe en la columna (254) y una contraseña enorme no sirve para nada
  // salvo para hacer trabajar a scrypt de más.
  if (correo.length > 254 || contrasena.length > 256) return { error: ERROR_CREDENCIALES, valores };

  const cuenta = await buscarCuentaPorCorreo(correo);
  hashDeRelleno ??= hashearContrasena("relleno-para-igualar-tiempos");
  const correcta = await verificarContrasena(contrasena, cuenta?.password_hash ?? (await hashDeRelleno));

  // Mismo mensaje si no existe la cuenta o si la contraseña falla: no se confirma qué correos existen.
  if (!cuenta || !correcta) return { error: ERROR_CREDENCIALES, valores };
  // La contraseña ya demostró que es su dueño: aquí sí se puede decir la causa (RN-64).
  if (cuenta.desactivada) return { error: "Esta cuenta está desactivada.", valores };

  // Si ya había una sesión en este navegador, se cierra: cada inicio de sesión estrena token.
  await cerrarSesion();
  await crearSesion(cuenta.id_cuenta);

  // redirect() lanza una excepción que Next convierte en redirección: va FUERA de cualquier try/catch.
  redirect(cuenta.es_empleado ? "/panel" : cuenta.es_lector ? "/cuenta" : "/");
}

export async function salir(): Promise<void> {
  // No exige estar conectado: si no hay sesión, no hay nada que borrar.
  await cerrarSesion();
  redirect("/");
}
