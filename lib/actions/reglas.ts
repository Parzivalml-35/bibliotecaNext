import "server-only";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { PoolConnection } from "mysql2/promise";
import {
  asignarReserva,
  bloquearEjemplarPorId,
  bloquearPrimeraEnCola,
  bloquearReservasVencidas,
  bloquearReservasVivasDelLector,
  cambiarEstadoEjemplar,
  cancelarReserva,
  marcarReservaVencida,
  type EstadoEjemplar,
} from "@/lib/data/circulacion";
import {
  asignarReservaDigital,
  bloquearColaDigital,
  bloquearLotesDelTitulo,
  vencerReservasDigitales,
  type LoteConUso,
} from "@/lib/data/digital";
import { enTransaccion } from "@/lib/db";
import type { EstadoFormulario } from "@/lib/definitions";
import { exigirEmpleado } from "@/lib/sesion";

// Reglas compartidas por las Server Actions (préstamos, reservas, multas, mostrador).
// SIN "use server" a propósito: este módulo exporta ayudantes, y en un archivo "use server" cada export
// sería un endpoint público. "server-only" impide además que un Client Component lo importe.

// Una regla de negocio que impide la operación. Se lanza dentro de la transacción para que enTransaccion
// haga ROLLBACK, y se convierte en un mensaje para el formulario. Cualquier otro error es un fallo real.
export class ErrorDeRegla extends Error {}

// Ejecuta la operación en una transacción y traduce el resultado. Si es una regla, el mensaje va al
// formulario; si no, se registra en el servidor y el usuario ve un mensaje genérico (sin detalles internos).
// `rutas`: qué páginas quedan desactualizadas tras la operación (revalidatePath).
export async function operar(
  valores: Record<string, string>,
  trabajo: (conexion: PoolConnection) => Promise<string>,
  rutas: string[] = ["/panel"],
): Promise<EstadoFormulario> {
  try {
    const exito = await enTransaccion(trabajo);
    for (const ruta of rutas) revalidatePath(ruta, "layout");
    return { exito };
  } catch (error) {
    if (error instanceof ErrorDeRegla) return { error: error.message, valores };
    console.error("Error en una operación:", error);
    return { error: "No se pudo completar la operación. Inténtalo de nuevo.", valores };
  }
}

export function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? "").trim();
}

// Un id que llega del navegador: entero positivo o null. Que exista y sea del usuario se comprueba aparte.
export function idDe(datos: FormData, campo: string): number | null {
  const n = Number(texto(datos, campo));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Tipos de documento de lector (ENUM de lector.tipo_documento). Lo usan el registro, la validación y el préstamo.
export const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PASAPORTE"];

// RN-33: préstamos, devoluciones, validar, ubicar y cobrar son de bibliotecario y coordinador. El
// administrador de red no tiene sede (RN-34) y no opera en mostrador.
export async function empleadoDeMostrador() {
  const empleado = await exigirEmpleado(["bibliotecario", "coordinador"]);
  // El CHECK ck_empleado_sede garantiza que estos roles tienen sede; se comprueba igual para que TS lo sepa.
  if (empleado.idSede === null) throw new Error("Empleado de mostrador sin sede");
  return { ...empleado, idSede: empleado.idSede };
}

export const NOMBRE_ESTADO: Record<EstadoEjemplar, string> = {
  disponible: "disponible",
  apartado: "apartado para una reserva",
  prestado: "prestado",
  por_ubicar: "por ubicar (aún no tiene estante en esta sede)",
  en_transito: "en tránsito",
  en_reparacion: "en reparación",
  perdido: "perdido",
  de_baja: "dado de baja",
};

type EjemplarParaLiberar = {
  id_ejemplar: number;
  id_libro: number;
  id_sede: number;
  id_ubicacion: number | null;
  ubicacion: string | null;
};

// RN-11, RN-20, RN-47, RN-69: a dónde va un ejemplar que queda libre en `idSede` (devuelto, ubicado, o
// apartado para una reserva que venció o se canceló). Si hay cola por esa obra en esa sede, se aparta para la
// primera reserva; si no, va a su estante (si lo tiene en esta sede) o queda por ubicar.
// `nuevaUbicacion`: al ubicar, el estante elegido por el empleado. Devuelve una frase para el empleado.
export async function liberarEjemplar(
  conexion: PoolConnection,
  ejemplar: EjemplarParaLiberar,
  estadoActual: EstadoEjemplar,
  idSede: number,
  nuevaUbicacion?: { id: number; etiqueta: string },
): Promise<string> {
  // La ubicación es de una sede concreta (FK compuesta): si el ejemplar cambia de sede, la pierde.
  const mismaSede = ejemplar.id_sede === idSede;
  const idUbicacion = nuevaUbicacion?.id ?? (mismaSede ? ejemplar.id_ubicacion : null);
  const etiqueta = nuevaUbicacion?.etiqueta ?? ejemplar.ubicacion;

  const siguiente = await bloquearPrimeraEnCola(conexion, ejemplar.id_libro, idSede);
  let nuevoEstado: EstadoEjemplar;
  let destino: string;
  if (siguiente) {
    nuevoEstado = "apartado"; // RN-11, RN-69: antes de dejarlo disponible, la cola
    destino = `apártalo en mostrador para la reserva de ${siguiente.lector}`;
  } else if (idUbicacion !== null) {
    nuevoEstado = "disponible"; // RN-47: en su sede vuelve a su estante sin pasar por "por ubicar"
    destino = `colócalo en su estante (${etiqueta})`;
  } else {
    nuevoEstado = "por_ubicar"; // RN-13, RN-20: llegó de otra sede (o no tenía estante)
    destino = "queda por ubicar en esta sede";
  }

  // RN-13: colección flotante. El ejemplar pasa a pertenecer a la sede donde queda libre.
  const cambiado = await cambiarEstadoEjemplar(conexion, ejemplar.id_ejemplar, estadoActual, {
    estado: nuevoEstado,
    idSede,
    idUbicacion,
  });
  if (!cambiado) throw new ErrorDeRegla("El ejemplar cambió de estado mientras se registraba. Vuelve a intentarlo.");
  if (siguiente) await asignarReserva(conexion, siguiente.id_reserva, ejemplar.id_ejemplar, siguiente.dias_recoger_reserva);
  return destino;
}

// RN-48: vencimiento perezoso. Antes de operar sobre una obra en una sede, las reservas asignadas que no se
// recogieron a tiempo pasan a `vencida` y su ejemplar se libera (para el siguiente de la cola, RN-10).
export async function procesarReservasVencidas(conexion: PoolConnection, idLibro: number, idSede: number) {
  const vencidas = await bloquearReservasVencidas(conexion, idLibro, idSede);
  for (const reserva of vencidas) {
    await marcarReservaVencida(conexion, reserva.id_reserva);
    const ejemplar = await bloquearEjemplarPorId(conexion, reserva.id_ejemplar);
    if (ejemplar?.estado === "apartado") await liberarEjemplar(conexion, ejemplar, "apartado", ejemplar.id_sede);
  }
}

// Cancela una reserva viva. Si estaba asignada, su ejemplar se libera para el siguiente (RN-10, RN-11).
export async function cancelarYLiberar(
  conexion: PoolConnection,
  reserva: { id_reserva: number; estado: "activa" | "asignada"; id_ejemplar: number | null },
) {
  await cancelarReserva(conexion, reserva.id_reserva);
  if (reserva.estado === "asignada" && reserva.id_ejemplar !== null) {
    const ejemplar = await bloquearEjemplarPorId(conexion, reserva.id_ejemplar);
    if (ejemplar?.estado === "apartado") await liberarEjemplar(conexion, ejemplar, "apartado", ejemplar.id_sede);
  }
}

// RN-68: al prestar una obra, las demás reservas vivas del lector por esa obra se cancelan.
// `excepto`: la reserva que este mismo préstamo cumple. Devuelve cuántas canceló.
export async function cancelarOtrasReservasDeLaObra(
  conexion: PoolConnection,
  idLector: number,
  idLibro: number,
  excepto: number | null,
): Promise<number> {
  const vivas = await bloquearReservasVivasDelLector(conexion, idLector, idLibro);
  let canceladas = 0;
  for (const reserva of vivas) {
    if (reserva.id_reserva === excepto) continue;
    await cancelarYLiberar(conexion, reserva);
    canceladas++;
  }
  return canceladas;
}

// IP de quien hace la petición, para RN-73. Next 16 solo rellena x-forwarded-for con la IP del socket si la
// petición NO lo trae (node_modules/next/dist/server/base-server.js): un cliente puede mandarlo inventado.
// Detrás de un proxy que AGREGA la IP real al final (Nginx con proxy_add_x_forwarded_for), la última entrada es
// la confiable, y por eso se toma esa. Con Next expuesto sin proxy, el límite por IP se puede evadir; el límite
// por correo no depende de la IP.
export async function ipDeLaPeticion(): Promise<string> {
  const lista = (await headers()).get("x-forwarded-for") ?? "";
  return lista.split(",").map((parte) => parte.trim()).filter(Boolean).at(-1)?.slice(0, 45) ?? "desconocida";
}

// "Enviar" un correo: no hay proveedor de correo todavía (RN-70), así que se escribe en la consola del
// servidor. Es el único lugar a cambiar el día que se conecte uno. Ojo: si se llama dentro de una transacción
// que después hace ROLLBACK, el "correo" ya salió; con un proveedor real se enviaría después del COMMIT.
export function enviarCorreo(destinatario: string, asunto: string, cuerpo: string) {
  console.log(`\n[correo simulado] Para: ${destinatario}\nAsunto: ${asunto}\n${cuerpo}\n`);
}

// ---------------------------------------------------------------------
// Préstamo digital (RN-28, RN-48, RN-55, RN-56)
// ---------------------------------------------------------------------

// RN-55: entre los lotes con licencias libres, el que vence antes entre los que cubren el préstamo completo
// (`dias`); si ninguno lo cubre, el que vence más tarde (y el préstamo se recorta, RN-44). null si no hay libres.
export function elegirLote(lotes: LoteConUso[], dias: number): LoteConUso | null {
  const libres = lotes.filter((l) => l.en_uso < l.cantidad);
  const restante = (l: LoteConUso) => l.segundos_restantes ?? Infinity; // sin vencimiento = el más lejano
  const cubren = libres.filter((l) => restante(l) >= dias * 86400).sort((a, b) => restante(a) - restante(b));
  if (cubren.length > 0) return cubren[0];
  return libres.sort((a, b) => restante(b) - restante(a))[0] ?? null;
}

// RN-28, RN-48: antes de operar sobre un título, se vencen las reservas asignadas sin confirmar y cada
// licencia libre se asigna al primero de la cola (con aviso por correo). "La cola manda", como en
// liberarEjemplar: así una licencia que queda libre nunca la toma alguien que llegó después.
// Bloquea los lotes del título (orden: lector → lotes → reservas) y devuelve los lotes con su uso ya al día.
export async function procesarColaDigital(conexion: PoolConnection, idLibro: number, titulo: string): Promise<LoteConUso[]> {
  let lotes = await bloquearLotesDelTitulo(conexion, idLibro);
  if (lotes.length === 0) return lotes;
  if ((await vencerReservasDigitales(conexion, idLibro)) > 0) lotes = await bloquearLotesDelTitulo(conexion, idLibro);

  const cola = await bloquearColaDigital(conexion, idLibro);
  for (const reserva of cola) {
    const lote = elegirLote(lotes, reserva.dias_prestamo_digital);
    if (!lote) break;
    const limite = await asignarReservaDigital(conexion, reserva.id_reserva_digital, lote.id_licencia);
    lote.en_uso++; // la reserva asignada retiene la licencia (RN-56)
    enviarCorreo(reserva.correo, `Ya puedes leer «${titulo}»`,
      `Hola, ${reserva.nombre}: se liberó una licencia para ti. Confírmala en «Mi cuenta» antes del ${limite}; si no, pasa al siguiente.`);
  }
  return lotes;
}

export const licenciasLibres = (lotes: LoteConUso[]) => lotes.reduce((suma, l) => suma + Math.max(0, l.cantidad - l.en_uso), 0);
