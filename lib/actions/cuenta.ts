"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashearContrasena } from "@/lib/contrasenas";
import { enTransaccion } from "@/lib/db";
import {
  bloquearLectorAValidar,
  bloquearTokenDeVerificacion,
  existeCuenta,
  existeTipoLector,
  insertarLectorRegistrado,
  registrarValidacion,
  usarTokenYVerificar,
} from "@/lib/data/lectores";
import type { EstadoFormulario } from "@/lib/definitions";
import { empleadoDeMostrador, ErrorDeRegla, idDe, ipDeLaPeticion, operar, texto } from "@/lib/actions/reglas";
import { anotarIntento, registroBloqueado } from "@/lib/data/intentos";

// Registro y verificación de lectores (D-02, RN-32, RN-70) y validación en mostrador (D-03).

const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");

// "Enviar" un correo: no hay proveedor de correo todavía (RN-70), así que se escribe en la consola del
// servidor. Es el único lugar a cambiar el día que se conecte uno.
function enviarCorreo(destinatario: string, asunto: string, cuerpo: string) {
  console.log(`\n[correo simulado] Para: ${destinatario}\nAsunto: ${asunto}\n${cuerpo}\n`);
}

export async function registrarLector(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo").toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const nombre = texto(datos, "nombre");
  const apellido = texto(datos, "apellido");
  const nacimiento = texto(datos, "fecha_nacimiento");
  const valores = { correo, nombre, apellido, fecha_nacimiento: nacimiento }; // la contraseña nunca vuelve

  // Validación en el servidor (los atributos required/type del formulario son solo comodidad).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) return { error: "Escribe un correo válido.", valores };
  if (contrasena.length < 12 || contrasena.length > 256) return { error: "La contraseña debe tener al menos 12 caracteres.", valores };
  if (!nombre || nombre.length > 60 || !apellido || apellido.length > 60) return { error: "Escribe tu nombre y tu apellido.", valores };
  const fecha = new Date(`${nacimiento}T00:00:00Z`);
  const edad = (Date.now() - fecha.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento) || Number.isNaN(fecha.getTime()) || edad < 0 || edad > 120) {
    return { error: "La fecha de nacimiento no es válida.", valores };
  }

  // RN-73: un límite de registros por IP frena la creación masiva de cuentas (y de "correos" enviados).
  const ip = await ipDeLaPeticion();
  if (await registroBloqueado(ip)) return { error: "Demasiados registros desde esta conexión. Inténtalo más tarde.", valores };
  await anotarIntento("registro", correo, ip, true);

  // El origen sale de la propia petición (un POST de Server Action trae Origin): el enlace apunta al sitio
  // desde el que se registró, sin variable de entorno nueva.
  const origen = (await headers()).get("origin") ?? "http://localhost:3000";
  const passwordHash = await hashearContrasena(contrasena); // ~300 ms: fuera de la transacción
  const token = randomBytes(32).toString("base64url");

  try {
    await enTransaccion(async (conexion) => {
      // Mismo mensaje exista o no la cuenta: la respuesta no revela qué correos están registrados. A quien
      // ya tiene cuenta se le avisa por correo, que solo él puede leer.
      if (await existeCuenta(conexion, correo)) {
        enviarCorreo(correo, "Intento de registro", "Alguien intentó crear una cuenta con tu correo. Si fuiste tú, inicia sesión.");
        return;
      }
      const horas = await insertarLectorRegistrado(conexion, {
        correo, passwordHash, nombre, apellido, nacimiento, tokenHash: hashDeToken(token),
      });
      enviarCorreo(correo, "Verifica tu correo", `Abre este enlace en las próximas ${horas} horas:\n${origen}/verificar?token=${token}`);
    });
  } catch (error) {
    // Dos registros simultáneos con el mismo correo: el UNIQUE de cuenta.correo frena al segundo.
    if ((error as { code?: string }).code !== "ER_DUP_ENTRY") {
      console.error("Error al registrar:", error);
      return { error: "No se pudo crear la cuenta. Inténtalo de nuevo.", valores };
    }
  }
  redirect("/registro?enviado=1");
}

// RN-32: el enlace lleva el token; la página muestra un botón que llama a esta acción. Así un GET (una
// vista previa del enlace, un antivirus que lo abre) no consume el token: solo el POST del botón.
export async function verificarCorreo(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const token = texto(datos, "token");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: "El enlace no es válido." };

  return operar(
    {},
    async (conexion) => {
      const fila = await bloquearTokenDeVerificacion(conexion, hashDeToken(token));
      if (!fila) throw new ErrorDeRegla("El enlace no es válido.");
      if (fila.usado) throw new ErrorDeRegla("Este enlace ya se usó: tu correo ya está verificado.");
      if (!fila.vigente) throw new ErrorDeRegla("El enlace venció. Regístrate de nuevo o pide otro enlace en mostrador.");
      await usarTokenYVerificar(conexion, fila.id_token, fila.id_cuenta);
      return "¡Correo verificado! Ya puedes reservar y pagar en línea. Para llevarte libros, valida tu documento en una sede.";
    },
    ["/cuenta"],
  );
}

const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PASAPORTE"];

// D-03, RN-70: el empleado comprueba el documento en persona y lo registra; puede cambiar el tipo de lector.
export async function validarLector(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador();
  const idLector = idDe(datos, "id_lector");
  const idTipoLector = idDe(datos, "id_tipo_lector");
  const tipoDocumento = texto(datos, "tipo_documento");
  const numeroDocumento = texto(datos, "numero_documento");
  const valores = { tipo_documento: tipoDocumento, numero_documento: numeroDocumento };
  if (!idLector || !idTipoLector) return { error: "Datos no válidos.", valores };
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) return { error: "Elige el tipo de documento.", valores };
  if (!/^[A-Za-z0-9]{3,20}$/.test(numeroDocumento)) return { error: "El número de documento no es válido.", valores };

  return operar(valores, async (conexion) => {
    const lector = await bloquearLectorAValidar(conexion, idLector);
    if (!lector) throw new ErrorDeRegla("Lector no encontrado.");
    if (lector.validado) throw new ErrorDeRegla(`${lector.nombre} ya está validado.`);
    // RN-01: registrada → verificada → validada, en ese orden.
    if (!lector.verificada) throw new ErrorDeRegla(`${lector.nombre} aún no verificó su correo.`);
    if (!(await existeTipoLector(conexion, idTipoLector))) throw new ErrorDeRegla("Tipo de lector no válido.");
    try {
      await registrarValidacion(conexion, { idLector, tipoDocumento, numeroDocumento, idTipoLector, idEmpleado: empleado.idEmpleado });
    } catch (error) {
      // uq_lector_documento: el documento ya pertenece a otro lector.
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new ErrorDeRegla("Ese documento ya está registrado para otro lector.");
      throw error;
    }
    return `${lector.nombre} quedó validado: ya puede llevarse libros.`;
  });
}
