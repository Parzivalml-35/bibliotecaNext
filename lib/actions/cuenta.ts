"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { estiloAlAzar } from "@/lib/avatar";
import { hashearContrasena } from "@/lib/contrasenas";
import { enTransaccion } from "@/lib/db";
import {
  actualizarContactoDeLector,
  bloquearLectorAValidar,
  bloquearTokenDeVerificacion,
  correoDelDocumento,
  existeCiudad,
  existeCuenta,
  existeTipoLector,
  insertarLectorRegistrado,
  registrarValidacion,
  usarTokenYVerificar,
} from "@/lib/data/lectores";
import type { EstadoFormulario } from "@/lib/definitions";
import { empleadoDeMostrador, enviarCorreo, ErrorDeRegla, errorDeContrasenaActual, idDe, ipDeLaPeticion, operar, texto, TIPOS_DOCUMENTO } from "@/lib/actions/reglas";
import { anotarIntento, registroBloqueado } from "@/lib/data/intentos";
import { bloquearTokenCambioCorreo, correoOcupado, crearTokenCambioCorreo, usarTokenYCambiarCorreo } from "@/lib/data/sesiones";
import { exigirLector, obtenerUsuario } from "@/lib/sesion";

// Registro y verificación de lectores (D-02, RN-32, RN-70), validación en mostrador (D-03), perfil (RN-77) y
// cambio de correo (RN-79).

const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Edad cumplida a hoy, a partir de "AAAA-MM-DD". null si la fecha no es válida.
function edadCumplida(nacimiento: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return null;
  const fecha = new Date(`${nacimiento}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== nacimiento) return null; // 2001-02-31
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - fecha.getUTCFullYear();
  const antesDelCumple = hoy.getUTCMonth() < fecha.getUTCMonth()
    || (hoy.getUTCMonth() === fecha.getUTCMonth() && hoy.getUTCDate() < fecha.getUTCDate());
  if (antesDelCumple) edad--;
  return edad >= 0 && edad <= 120 ? edad : null;
}

// RN-74, RN-77: teléfono y dirección se validan igual en el registro y en el perfil. Una sola función para que las
// dos no se separen con el tiempo. Devuelve el mensaje del primer error o null. Sin export: en un archivo
// "use server" cada export se vuelve una acción que el navegador puede llamar.
function errorDeContacto(telefono: string, calle: string, codigoPostal: string, idCiudad: number | null): string | null {
  if (!/^\+?[0-9 ]{7,20}$/.test(telefono)) return "Escribe un teléfono válido (solo números y espacios).";
  if (!calle || calle.length > 120) return "Escribe tu dirección.";
  if (codigoPostal && !/^[0-9]{4,10}$/.test(codigoPostal)) return "El código postal no es válido.";
  if (!idCiudad) return "Elige tu ciudad.";
  return null;
}

export async function registrarLector(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const correo = texto(datos, "correo").toLowerCase();
  const contrasena = String(datos.get("contrasena") ?? "");
  const nombre = texto(datos, "nombre");
  const apellido = texto(datos, "apellido");
  const nacimiento = texto(datos, "fecha_nacimiento");
  const tipoDocumento = texto(datos, "tipo_documento");
  const numeroDocumento = texto(datos, "numero_documento").toUpperCase();
  const telefono = texto(datos, "telefono");
  const calle = texto(datos, "calle");
  const codigoPostal = texto(datos, "codigo_postal");
  const idCiudad = idDe(datos, "id_ciudad");
  const valores = { // la contraseña nunca vuelve
    correo, nombre, apellido, fecha_nacimiento: nacimiento, tipo_documento: tipoDocumento,
    numero_documento: numeroDocumento, telefono, calle, codigo_postal: codigoPostal, id_ciudad: texto(datos, "id_ciudad"),
  };

  // Validación en el servidor (los atributos required/type del formulario son solo comodidad).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) return { error: "Escribe un correo válido.", valores };
  if (contrasena.length < 12 || contrasena.length > 256) return { error: "La contraseña debe tener al menos 12 caracteres.", valores };
  if (!nombre || nombre.length > 60 || !apellido || apellido.length > 60) return { error: "Escribe tu nombre y tu apellido.", valores };
  const edad = edadCumplida(nacimiento);
  if (edad === null) return { error: "La fecha de nacimiento no es válida.", valores };
  // RN-74: identidad y contacto, para verificar la edad y ubicar a quien no devuelva un libro.
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) return { error: "Elige el tipo de documento.", valores };
  if (!/^[A-Z0-9]{3,20}$/.test(numeroDocumento)) return { error: "El número de documento no es válido (solo letras y números).", valores };
  if (tipoDocumento === "CC" && edad < 18) return { error: "La cédula de ciudadanía es para mayores de 18 años; si eres menor, usa tu tarjeta de identidad.", valores };
  if (tipoDocumento === "TI" && edad >= 18) return { error: "La tarjeta de identidad es para menores de 18 años; usa tu cédula.", valores };
  const errorContacto = errorDeContacto(telefono, calle, codigoPostal, idCiudad);
  // `|| !idCiudad`: errorDeContacto ya lo comprueba, pero TypeScript no lo sabe; así idCiudad queda como number.
  if (errorContacto || !idCiudad) return { error: errorContacto ?? "Elige tu ciudad.", valores };

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
      // RN-74: lo mismo con el documento. Se avisa al dueño de la cuenta que ya lo tiene, no a quien lo escribió.
      const dueno = await correoDelDocumento(conexion, tipoDocumento, numeroDocumento);
      if (dueno) {
        enviarCorreo(dueno, "Intento de registro con tu documento",
          "Alguien intentó crear una cuenta con tu número de documento. Si no fuiste tú, avísanos en cualquier sede.");
        return;
      }
      if (!(await existeCiudad(conexion, idCiudad))) throw new ErrorDeRegla("Elige tu ciudad.");
      const horas = await insertarLectorRegistrado(conexion, {
        correo, passwordHash, nombre, apellido, nacimiento, tipoDocumento, numeroDocumento, telefono, calle,
        codigoPostal: codigoPostal || null, idCiudad, tokenHash: hashDeToken(token),
        avatarEstilo: estiloAlAzar(), // RN-81: toda cuenta nace con un avatar genérico al azar
      });
      enviarCorreo(correo, "Verifica tu correo", `Abre este enlace en las próximas ${horas} horas:\n${origen}/verificar?token=${token}`);
    });
  } catch (error) {
    if (error instanceof ErrorDeRegla) return { error: error.message, valores };
    // Dos registros simultáneos con el mismo correo o documento: el UNIQUE frena al segundo, y recibe la
    // misma respuesta que todos.
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
      return "¡Correo verificado! Ya puedes reservar, leer libros digitales y pagar en línea. Para llevarte libros físicos, presenta tu documento en una sede.";
    },
    ["/cuenta"],
  );
}

// D-03, RN-70: el empleado coteja el documento registrado con el original y lo corrige si no coincide; puede
// cambiar el tipo de lector.
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

// RN-77: el lector cambia su teléfono y su dirección desde "Mi cuenta". El idLector sale de la sesión, nunca del
// formulario: así nadie puede cambiar los datos de otro lector mandando otro id (RN-35).
export async function actualizarContacto(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lector = await exigirLector();
  const telefono = texto(datos, "telefono");
  const calle = texto(datos, "calle");
  const codigoPostal = texto(datos, "codigo_postal");
  const idCiudad = idDe(datos, "id_ciudad");
  const valores = { telefono, calle, codigo_postal: codigoPostal, id_ciudad: texto(datos, "id_ciudad") };

  const errorContacto = errorDeContacto(telefono, calle, codigoPostal, idCiudad);
  // `|| !idCiudad`: errorDeContacto ya lo comprueba, pero TypeScript no lo sabe; así idCiudad queda como number.
  if (errorContacto || !idCiudad) return { error: errorContacto ?? "Elige tu ciudad.", valores };

  return operar(
    valores,
    async (conexion) => {
      if (!(await existeCiudad(conexion, idCiudad))) throw new ErrorDeRegla("Elige tu ciudad.");
      await actualizarContactoDeLector(conexion, lector.idLector, { telefono, calle, codigoPostal: codigoPostal || null, idCiudad });
      return "Datos guardados.";
    },
    ["/cuenta/perfil"],
  );
}

// RN-79, paso 1: pedir el cambio de correo. Exige la contraseña actual (RN-73, como RN-78) y envía un enlace AL CORREO
// NUEVO: así se comprueba que la persona lo controla. Hasta que lo abra, la cuenta sigue con el correo anterior.
// Es de la cuenta (RN-31): pide cualquier sesión, no exigirLector.
export async function solicitarCambioCorreo(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  const correoNuevo = texto(datos, "correo_nuevo").toLowerCase();
  const contrasena = String(datos.get("contrasena_actual") ?? "");
  const valores = { correo_nuevo: correoNuevo }; // la contraseña nunca vuelve

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNuevo) || correoNuevo.length > 254) return { error: "Escribe un correo válido.", valores };
  if (correoNuevo === usuario.correo) return { error: "Ese ya es el correo de tu cuenta.", valores };
  const error = await errorDeContrasenaActual(usuario.correo, contrasena);
  if (error) return { error, valores };

  const origen = (await headers()).get("origin") ?? "http://localhost:3000";
  const token = randomBytes(32).toString("base64url");
  // Mismo mensaje haya o no otra cuenta con ese correo (RN-79, como RN-70): la respuesta no revela qué correos
  // están registrados. Si está ocupado, simplemente no se crea el enlace.
  const respuesta = `Si ${correoNuevo} puede usarse, te enviamos ahí un enlace para confirmar el cambio. Hasta que lo abras, tu correo sigue siendo ${usuario.correo}.`;
  return operar(
    valores,
    async (conexion) => {
      if (await correoOcupado(conexion, correoNuevo)) return respuesta;
      const horas = await crearTokenCambioCorreo(conexion, usuario.idCuenta, correoNuevo, hashDeToken(token));
      enviarCorreo(correoNuevo, "Confirma tu nuevo correo",
        `Para usar este correo en tu cuenta de la biblioteca, abre este enlace en las próximas ${horas} horas:\n${origen}/confirmar-correo?token=${token}\nSi no lo pediste, ignora este mensaje.`);
      return respuesta;
    },
    [],
  );
}

// RN-79, paso 2: el POST del botón de /confirmar-correo (abrir el enlace no cambia nada, RN-32). No exige sesión:
// el enlace puede abrirse en otro dispositivo, y lo que prueba quién es la persona es el token, que solo llegó al
// correo nuevo. Se comprueba OTRA VEZ que el correo sigue libre: pudo registrarse alguien con él mientras tanto.
export async function confirmarCambioCorreo(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const token = texto(datos, "token");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: "El enlace no es válido." };

  return operar(
    {},
    async (conexion) => {
      const fila = await bloquearTokenCambioCorreo(conexion, hashDeToken(token));
      if (!fila || fila.desactivada) throw new ErrorDeRegla("El enlace no es válido.");
      if (fila.usado) throw new ErrorDeRegla("Este enlace ya se usó.");
      if (!fila.vigente) throw new ErrorDeRegla("El enlace venció. Pide el cambio otra vez desde Seguridad.");
      if (await correoOcupado(conexion, fila.correo_nuevo)) {
        throw new ErrorDeRegla("Ese correo ya no está disponible. Tu cuenta sigue con el correo anterior.");
      }
      await usarTokenYCambiarCorreo(conexion, fila.id_token, fila.id_cuenta, fila.correo_nuevo);
      // Aviso al correo ANTERIOR: si no fue su dueño quien hizo el cambio, así se entera (RN-79).
      enviarCorreo(fila.correo_actual, "Tu correo cambió",
        `El correo de tu cuenta de la biblioteca cambió a ${fila.correo_nuevo}. Si no fuiste tú, acércate a cualquier sede.`);
      return `Listo: tu cuenta ahora usa ${fila.correo_nuevo}. Úsalo para iniciar sesión.`;
    },
    // "/" con "layout": todo el sitio, porque el correo aparece en el menú de la cuenta de la barra superior.
    ["/"],
  );
}
