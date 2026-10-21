"use server";

import { revalidatePath } from "next/cache";
import type { PoolConnection } from "mysql2/promise";
import {
  asignarReserva,
  bloquearEjemplarPorCodigo,
  bloquearEjemplarPorId,
  bloquearLectorPorDocumento,
  bloquearPrestamoAbiertoDelEjemplar,
  bloquearPrestamoParaRenovar,
  bloquearPrimeraEnCola,
  bloquearReservaAsignada,
  bloquearReservasVencidas,
  cambiarEstadoEjemplar,
  cumplirReserva,
  extenderPrestamo,
  hayReservaEnCola,
  insertarMultaPorRetraso,
  insertarPrestamo,
  marcarReservaVencida,
  registrarDevolucion,
  situacionDelLector,
  type EstadoEjemplar,
} from "@/lib/data/circulacion";
import { enTransaccion } from "@/lib/db";
import type { EstadoFormulario } from "@/lib/definitions";
import { fechaCorta, pesos } from "@/lib/formato";
import { exigirEmpleado } from "@/lib/sesion";

// Préstamo, devolución y renovación de ejemplares físicos (Fase 3, partes B y C).
// Cada acción: 1) exige empleado con sede (RN-33, RN-34, RN-35); 2) valida la entrada; 3) aplica las reglas
// dentro de UNA transacción (RN-23); 4) devuelve un mensaje para useActionState.
// Recordatorio: todo lo exportado aquí es un endpoint público; los ayudantes NO se exportan.

// Una regla de negocio que impide la operación. Se lanza dentro de la transacción para que enTransaccion
// haga ROLLBACK, y se convierte en un mensaje para el formulario. Cualquier otro error es un fallo real.
class ErrorDeRegla extends Error {}

// RN-33: préstamos y devoluciones son de bibliotecario y coordinador. El administrador de red no tiene sede
// (RN-34) y no opera en mostrador.
const ROLES_DE_MOSTRADOR = ["bibliotecario", "coordinador"] as const;

async function empleadoDeMostrador() {
  const empleado = await exigirEmpleado([...ROLES_DE_MOSTRADOR]);
  // El CHECK ck_empleado_sede garantiza que estos roles tienen sede; se comprueba igual para que TS lo sepa.
  if (empleado.idSede === null) throw new Error("Empleado de mostrador sin sede");
  return { ...empleado, idSede: empleado.idSede };
}

const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PASAPORTE"];

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? "").trim();
}

// Códigos de barras: letras, números y guion (BN-0001). Se normalizan a mayúsculas.
function codigoDeBarras(datos: FormData): string | null {
  const codigo = texto(datos, "codigo").toUpperCase();
  return /^[A-Z0-9-]{1,30}$/.test(codigo) ? codigo : null;
}

// Ejecuta la operación y traduce el resultado. Si es una regla, el mensaje va al formulario; si no,
// se registra en el servidor y el usuario ve un mensaje genérico (no se filtran detalles internos).
async function operar(
  valores: Record<string, string>,
  trabajo: (conexion: PoolConnection) => Promise<string>,
): Promise<EstadoFormulario> {
  try {
    const exito = await enTransaccion(trabajo);
    revalidatePath("/panel", "layout"); // el listado del panel y las demás páginas bajo /panel
    return { exito };
  } catch (error) {
    if (error instanceof ErrorDeRegla) return { error: error.message, valores };
    console.error("Error en una operación de circulación:", error);
    return { error: "No se pudo completar la operación. Inténtalo de nuevo.", valores };
  }
}

// RN-11, RN-20, RN-47: a dónde va un ejemplar que queda libre (devuelto, o apartado para una reserva que
// venció) en `idSede`. Si hay cola por esa obra en esa sede, se aparta para la primera reserva; si no,
// vuelve a su estante (si lo tiene en esta sede) o queda por ubicar. Devuelve una frase para el empleado.
async function liberarEjemplar(
  conexion: PoolConnection,
  ejemplar: { id_ejemplar: number; id_libro: number; id_sede: number; id_ubicacion: number | null; ubicacion: string | null },
  estadoActual: EstadoEjemplar,
  idSede: number,
): Promise<string> {
  // La ubicación es de una sede concreta (FK compuesta): si el ejemplar cambia de sede, la pierde.
  const mismaSede = ejemplar.id_sede === idSede;
  const idUbicacion = mismaSede ? ejemplar.id_ubicacion : null;

  const siguiente = await bloquearPrimeraEnCola(conexion, ejemplar.id_libro, idSede);
  let nuevoEstado: EstadoEjemplar;
  let destino: string;
  if (siguiente) {
    nuevoEstado = "apartado"; // RN-11: antes de dejarlo disponible, la cola
    destino = `apártalo en mostrador para la reserva de ${siguiente.lector}`;
  } else if (idUbicacion !== null) {
    nuevoEstado = "disponible"; // RN-47: en su sede vuelve a su estante sin pasar por "por ubicar"
    destino = `devuélvelo a su estante (${ejemplar.ubicacion})`;
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
async function procesarReservasVencidas(conexion: PoolConnection, idLibro: number, idSede: number) {
  const vencidas = await bloquearReservasVencidas(conexion, idLibro, idSede);
  for (const reserva of vencidas) {
    await marcarReservaVencida(conexion, reserva.id_reserva);
    const ejemplar = await bloquearEjemplarPorId(conexion, reserva.id_ejemplar);
    if (ejemplar?.estado === "apartado") await liberarEjemplar(conexion, ejemplar, "apartado", ejemplar.id_sede);
  }
}

const NOMBRE_ESTADO: Record<EstadoEjemplar, string> = {
  disponible: "disponible",
  apartado: "apartado para una reserva",
  prestado: "prestado",
  por_ubicar: "por ubicar (aún no tiene estante en esta sede)",
  en_transito: "en tránsito",
  en_reparacion: "en reparación",
  perdido: "perdido",
  de_baja: "dado de baja",
};

// ---------------------------------------------------------------------
// Préstamo (RN-02, RN-03, RN-10, RN-23, RN-34, RN-43, RN-46, RN-48, D-03)
// ---------------------------------------------------------------------
export async function prestarEjemplar(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador();

  const tipoDocumento = texto(datos, "tipo_documento");
  const numeroDocumento = texto(datos, "numero_documento");
  const codigo = codigoDeBarras(datos);
  const valores = { tipo_documento: tipoDocumento, numero_documento: numeroDocumento, codigo: texto(datos, "codigo") };

  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) return { error: "Elige el tipo de documento.", valores };
  if (!/^[A-Za-z0-9]{3,20}$/.test(numeroDocumento)) return { error: "El número de documento no es válido.", valores };
  if (!codigo) return { error: "El código de barras no es válido.", valores };

  return operar(valores, async (conexion) => {
    // Orden de bloqueo fijo (ejemplar → reservas → lector) en todas las operaciones: dos transacciones que
    // piden las mismas filas en el mismo orden esperan en fila en vez de bloquearse mutuamente (deadlock).
    let ejemplar = await bloquearEjemplarPorCodigo(conexion, codigo);
    if (!ejemplar) throw new ErrorDeRegla(`No existe un ejemplar con el código ${codigo}.`);
    // RN-34: solo se presta lo que está en la sede del empleado.
    if (ejemplar.id_sede !== empleado.idSede) {
      throw new ErrorDeRegla(`El ejemplar ${codigo} está en ${ejemplar.sede}; solo puedes prestar ejemplares de ${empleado.sede}.`);
    }

    await procesarReservasVencidas(conexion, ejemplar.id_libro, ejemplar.id_sede); // RN-48
    ejemplar = (await bloquearEjemplarPorCodigo(conexion, codigo))!; // su estado pudo cambiar al procesarlas

    const lector = await bloquearLectorPorDocumento(conexion, tipoDocumento, numeroDocumento);
    if (!lector) throw new ErrorDeRegla(`No hay un lector con documento ${tipoDocumento} ${numeroDocumento}.`);
    if (lector.desactivada) throw new ErrorDeRegla(`La cuenta de ${lector.nombre} está desactivada.`);
    if (!lector.validado) {
      throw new ErrorDeRegla(`${lector.nombre} aún no está validado: valida su documento en mostrador antes de prestarle (D-03).`);
    }
    // RN-03, RN-43: el bloqueo se calcula en el momento, no se guarda. Se cuenta DESPUÉS de bloquear al lector.
    const situacion = await situacionDelLector(conexion, lector.id_lector);
    if (situacion.vencidos > 0) throw new ErrorDeRegla(`${lector.nombre} está bloqueado: tiene préstamos vencidos sin devolver.`);
    if (situacion.multasPendientes > 0) throw new ErrorDeRegla(`${lector.nombre} está bloqueado: tiene multas pendientes de pago.`);
    // RN-02
    if (situacion.abiertos >= lector.max_prestamos_fisicos) {
      throw new ErrorDeRegla(`${lector.nombre} ya tiene ${situacion.abiertos} de ${lector.max_prestamos_fisicos} préstamos permitidos.`);
    }
    // RN-46: la edad se calcula con la fecha de nacimiento.
    if (lector.edad < ejemplar.edad_minima) {
      throw new ErrorDeRegla(`«${ejemplar.titulo}» es para ${ejemplar.clasificacion}; ${lector.nombre} tiene ${lector.edad} años.`);
    }

    // Disponible, o apartado para una reserva de ESTE lector (recoger la reserva, RN-10).
    let reserva = null;
    if (ejemplar.estado === "apartado") {
      reserva = await bloquearReservaAsignada(conexion, ejemplar.id_ejemplar);
      if (!reserva || reserva.id_lector !== lector.id_lector) {
        throw new ErrorDeRegla(`El ejemplar ${codigo} está apartado para la reserva de ${reserva?.lector ?? "otro lector"}.`);
      }
    } else if (ejemplar.estado !== "disponible") {
      throw new ErrorDeRegla(`El ejemplar ${codigo} no se puede prestar: está ${NOMBRE_ESTADO[ejemplar.estado]}.`);
    }

    // RN-23: el estado se actualiza en la misma transacción que el préstamo, con candado.
    const cambiado = await cambiarEstadoEjemplar(conexion, ejemplar.id_ejemplar, ejemplar.estado, {
      estado: "prestado",
      idSede: ejemplar.id_sede,
      idUbicacion: ejemplar.id_ubicacion, // conserva su estante: vuelve ahí si se devuelve en esta sede (RN-47)
    });
    if (!cambiado) throw new ErrorDeRegla("El ejemplar cambió de estado mientras se registraba. Vuelve a intentarlo.");

    const { idPrestamo, vence } = await insertarPrestamo(conexion, {
      idEjemplar: ejemplar.id_ejemplar,
      idLector: lector.id_lector,
      idSede: empleado.idSede,
      idEmpleado: empleado.idEmpleado,
      dias: lector.dias_prestamo_fisico,
    });
    if (reserva) await cumplirReserva(conexion, reserva.id_reserva, idPrestamo);

    return `Prestado «${ejemplar.titulo}» (${codigo}) a ${lector.nombre}. Vence el ${fechaCorta(vence)}.${reserva ? " Su reserva quedó cumplida." : ""}`;
  });
}

// ---------------------------------------------------------------------
// Devolución (RN-05, RN-11, RN-13, RN-20, RN-23, RN-47, RN-48)
// ---------------------------------------------------------------------
export async function devolverEjemplar(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador();
  const codigo = codigoDeBarras(datos);
  const valores = { codigo: texto(datos, "codigo") };
  if (!codigo) return { error: "El código de barras no es válido.", valores };

  return operar(valores, async (conexion) => {
    const ejemplar = await bloquearEjemplarPorCodigo(conexion, codigo);
    if (!ejemplar) throw new ErrorDeRegla(`No existe un ejemplar con el código ${codigo}.`);
    const prestamo = await bloquearPrestamoAbiertoDelEjemplar(conexion, ejemplar.id_ejemplar);
    if (!prestamo) throw new ErrorDeRegla(`El ejemplar ${codigo} no tiene un préstamo abierto.`);

    // RN-13: se puede devolver en cualquier sede; queda registrada la del empleado que lo recibe.
    await registrarDevolucion(conexion, prestamo.id_prestamo, empleado.idSede, empleado.idEmpleado);

    // RN-05: la multa se genera al devolver.
    let multa = "";
    if (prestamo.dias_atraso > 0) {
      const monto = await insertarMultaPorRetraso(conexion, prestamo.id_prestamo, prestamo.dias_atraso);
      multa = ` Multa por ${prestamo.dias_atraso} ${prestamo.dias_atraso === 1 ? "día" : "días"} de retraso: ${pesos(monto)}.`;
    }

    await procesarReservasVencidas(conexion, ejemplar.id_libro, empleado.idSede); // RN-48, antes de mirar la cola
    const destino = await liberarEjemplar(conexion, ejemplar, "prestado", empleado.idSede);

    const otraSede = ejemplar.id_sede !== empleado.idSede ? ` Era de ${ejemplar.sede}; ahora pertenece a ${empleado.sede}.` : "";
    return `Devuelto «${ejemplar.titulo}» (${codigo}), prestado a ${prestamo.lector}.${multa}${otraSede} Siguiente paso: ${destino}.`;
  });
}

// ---------------------------------------------------------------------
// Renovación (RN-04, RN-65)
// ---------------------------------------------------------------------
export async function renovarPrestamo(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador();
  const idPrestamo = Number(texto(datos, "id_prestamo"));
  if (!Number.isInteger(idPrestamo) || idPrestamo <= 0) return { error: "Préstamo no válido." };

  return operar({}, async (conexion) => {
    const prestamo = await bloquearPrestamoParaRenovar(conexion, idPrestamo);
    // El id viene del navegador: se comprueba que exista y que sea de la sede del empleado (RN-34).
    if (!prestamo || prestamo.id_sede_prestamo !== empleado.idSede) throw new ErrorDeRegla("Préstamo no encontrado en tu sede.");
    if (prestamo.devuelto) throw new ErrorDeRegla("Ese préstamo ya fue devuelto.");
    if (prestamo.vencido) throw new ErrorDeRegla("Un préstamo vencido no se puede renovar (RN-04).");
    if (prestamo.renovaciones >= prestamo.max_renovaciones) {
      throw new ErrorDeRegla(`Ya se renovó ${prestamo.renovaciones} veces, el máximo permitido.`);
    }
    if (await hayReservaEnCola(conexion, prestamo.id_libro)) {
      throw new ErrorDeRegla("Hay lectores en cola por esta obra: no se puede renovar (RN-04).");
    }

    const vence = await extenderPrestamo(conexion, prestamo.id_prestamo, prestamo.dias_prestamo_fisico);
    return `Renovado. Nuevo vencimiento: ${fechaCorta(vence)}.`;
  });
}
