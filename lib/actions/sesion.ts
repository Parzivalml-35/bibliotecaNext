"use server";

import { redirect } from "next/navigation";
import { hashearContrasena, verificarContrasena } from "@/lib/contrasenas";
import { errorDeContrasenaActual, ipDeLaPeticion, operar } from "@/lib/actions/reglas";
import { anotarIntento, loginBloqueado } from "@/lib/data/intentos";
import { buscarCuentaPorCorreo, cambiarContrasenaYCerrarOtras } from "@/lib/data/sesiones";
import type { EstadoFormulario } from "@/lib/definitions";
import { inicioDe } from "@/lib/permisos";
import { cerrarSesion, crearSesion, hashDeLaSesionActual, obtenerUsuario, rutaInterna } from "@/lib/sesion";

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

  // RN-73: con demasiados fallos recientes se rechaza ANTES de scrypt (cada intento cuesta ~300 ms de CPU:
  // sin esto, el atacante además hace trabajar al servidor). Se cuenta igual exista o no el correo.
  const ip = await ipDeLaPeticion();
  if (await loginBloqueado(correo, ip)) {
    return { error: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.", valores };
  }

  const cuenta = await buscarCuentaPorCorreo(correo);
  hashDeRelleno ??= hashearContrasena("relleno-para-igualar-tiempos");
  const correcta = await verificarContrasena(contrasena, cuenta?.password_hash ?? (await hashDeRelleno));
  await anotarIntento("login", correo, ip, Boolean(cuenta && correcta));

  // Mismo mensaje si no existe la cuenta o si la contraseña falla: no se confirma qué correos existen.
  if (!cuenta || !correcta) return { error: ERROR_CREDENCIALES, valores };
  // La contraseña ya demostró que es su dueño: aquí sí se puede decir la causa (RN-64).
  if (cuenta.desactivada) return { error: "Esta cuenta está desactivada.", valores };

  // Si ya había una sesión en este navegador, se cierra: cada inicio de sesión estrena token.
  await cerrarSesion();
  await crearSesion(cuenta.id_cuenta);

  // RN-83: volver a donde estaba, si es una ruta de este sitio. Se valida OTRA VEZ aunque la página ya lo hizo:
  // esta acción es un endpoint público y el campo oculto lo puede cambiar cualquiera. Si no vale, el destino por perfil.
  const siguiente = rutaInterna(datos.get("siguiente"));
  // redirect() lanza una excepción que Next convierte en redirección: va FUERA de cualquier try/catch.
  // El empleado va directo al inicio de su rol (DI-10), sin pasar por /panel: esa página solo redirige, y en desarrollo
  // React no sabe medir un componente que siempre termina en redirect() (aviso de performance.measure).
  redirect(siguiente ?? (cuenta.rol_empleado ? inicioDe(cuenta.rol_empleado) : cuenta.es_lector ? "/cuenta" : "/"));
}

export async function salir(): Promise<void> {
  // No exige estar conectado: si no hay sesión, no hay nada que borrar.
  await cerrarSesion();
  redirect("/");
}

// RN-78: cambiar la contraseña desde una sesión abierta. Es de la CUENTA (RN-31), no del perfil: por eso pide
// cualquier sesión (obtenerUsuario) y no exigirLector; el panel la reutilizará para los empleados (R7i).
export async function cambiarContrasena(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  const actual = String(datos.get("contrasena_actual") ?? "");
  const nueva = String(datos.get("contrasena_nueva") ?? "");
  const confirmacion = String(datos.get("contrasena_confirmacion") ?? "");
  // Sin `valores`: ninguna contraseña vuelve al navegador. Tras la acción, React vacía los campos.

  if (nueva.length < 12 || nueva.length > 256) return { error: "La contraseña nueva debe tener al menos 12 caracteres." }; // RN-70
  // RN-78: escrita dos veces, para no quedar con una contraseña que nadie sabe por un error al teclear.
  if (nueva !== confirmacion) return { error: "Las dos contraseñas nuevas no coinciden." };
  // RN-78: distinta de la actual (cambiarla por la misma no protege nada). Se comparan los dos textos del formulario,
  // con la misma normalización NFC que usa scrypt (lib/contrasenas.ts): "ñ" escrita de dos formas cuenta como igual.
  // No revela nada: si `actual` no fuera la correcta, la comparación solo dice que el usuario escribió lo mismo dos veces.
  if (nueva.normalize("NFC") === actual.normalize("NFC")) return { error: "La contraseña nueva debe ser distinta de la actual." };

  // RN-73 y la contraseña actual, como en el login (ver errorDeContrasenaActual).
  const error = await errorDeContrasenaActual(usuario.correo, actual);
  if (error) return { error };

  const tokenHashActual = await hashDeLaSesionActual();
  if (!tokenHashActual) redirect("/login"); // no debería pasar: obtenerUsuario ya leyó la cookie
  const passwordHash = await hashearContrasena(nueva); // RN-62. ~300 ms: fuera de la transacción

  return operar(
    {},
    async (conexion) => {
      const cerradas = await cambiarContrasenaYCerrarOtras(conexion, usuario.idCuenta, passwordHash, tokenHashActual);
      return cerradas === 0
        ? "Contraseña cambiada."
        : `Contraseña cambiada. Cerramos tu sesión en ${cerradas === 1 ? "otro dispositivo" : `${cerradas} dispositivos más`}.`;
    },
    [], // nada que revalidar: ninguna página muestra la contraseña ni las sesiones
  );
}
