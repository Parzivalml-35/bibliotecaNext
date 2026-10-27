"use server";

import {
  bloquearEjemplarPorCodigo,
  bloquearLectorPorDocumento,
  bloquearPrestamoAbiertoDelEjemplar,
  bloquearPrestamoParaPerdido,
  bloquearPrestamoParaRenovar,
  bloquearPrimeraEnCola,
  bloquearReservaAsignada,
  cambiarEstadoEjemplar,
  cumplirReserva,
  extenderPrestamo,
  hayReservaEnCola,
  insertarMultaPorRetraso,
  insertarMultaReposicion,
  insertarPrestamo,
  registrarDevolucion,
  situacionDelLector,
  tienePrestadaLaObra,
  ubicacionEsDeSede,
} from "@/lib/data/circulacion";
import type { EstadoFormulario } from "@/lib/definitions";
import { fechaCorta, pesos } from "@/lib/formato";
import {
  cancelarOtrasReservasDeLaObra,
  empleadoDeMostrador,
  ErrorDeRegla,
  idDe,
  liberarEjemplar,
  NOMBRE_ESTADO,
  operar,
  procesarReservasVencidas,
  texto,
  TIPOS_DOCUMENTO,
} from "@/lib/actions/reglas";

// Circulación en mostrador: préstamo, devolución, renovación (Fase 3), ubicar y declarar perdido (Fase 4).
// Cada acción: 1) exige empleado con sede (RN-33, RN-34, RN-35); 2) valida la entrada; 3) aplica las reglas
// dentro de UNA transacción (RN-23); 4) devuelve un mensaje para useActionState.
// Todo lo exportado aquí es un endpoint público; los ayudantes viven en lib/actions/reglas.ts.

// Códigos de barras: letras, números y guion (BN-0001). Se normalizan a mayúsculas.
function codigoDeBarras(datos: FormData): string | null {
  const codigo = texto(datos, "codigo").toUpperCase();
  return /^[A-Z0-9-]{1,30}$/.test(codigo) ? codigo : null;
}

// ---------------------------------------------------------------------
// Préstamo (RN-02, RN-03, RN-10, RN-23, RN-34, RN-43, RN-46, RN-48, RN-68, RN-69, RN-75, D-03)
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
    // RN-75: una sola copia de cada obra. Lectura con bloqueo (FOR SHARE) DESPUÉS de bloquear al lector, como
    // situacionDelLector: si otro mostrador le está prestando otra copia, esta espera su COMMIT y la ve.
    if (await tienePrestadaLaObra(conexion, lector.id_lector, ejemplar.id_libro)) {
      throw new ErrorDeRegla(`${lector.nombre} ya tiene prestado «${ejemplar.titulo}»: no se presta otra copia de la misma obra.`);
    }
    // RN-46: la edad se calcula con la fecha de nacimiento.
    if (lector.edad < ejemplar.edad_minima) {
      throw new ErrorDeRegla(`«${ejemplar.titulo}» es para ${ejemplar.clasificacion}; ${lector.nombre} tiene ${lector.edad} años.`);
    }

    // Apartado para una reserva de ESTE lector (recoger la reserva, RN-10), o disponible.
    let idReservaCumplida: number | null = null;
    if (ejemplar.estado === "apartado") {
      const reserva = await bloquearReservaAsignada(conexion, ejemplar.id_ejemplar);
      if (!reserva || reserva.id_lector !== lector.id_lector) {
        throw new ErrorDeRegla(`El ejemplar ${codigo} está apartado para la reserva de ${reserva?.lector ?? "otro lector"}.`);
      }
      idReservaCumplida = reserva.id_reserva;
    } else if (ejemplar.estado === "disponible") {
      // RN-69: la cola manda. Con lectores en cola por esta obra en esta sede, la copia es del primero.
      const primera = await bloquearPrimeraEnCola(conexion, ejemplar.id_libro, ejemplar.id_sede);
      if (primera && primera.id_lector !== lector.id_lector) {
        throw new ErrorDeRegla(`Hay lectores en cola por «${ejemplar.titulo}» en esta sede: la copia es para ${primera.lector}.`);
      }
      if (primera) idReservaCumplida = primera.id_reserva; // el primero de la cola se la lleva: reserva cumplida
    } else {
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
    if (idReservaCumplida) await cumplirReserva(conexion, idReservaCumplida, idPrestamo, ejemplar.id_ejemplar);
    // RN-68: si además tenía reservada esta obra en otra sede, esa reserva ya no tiene sentido.
    const canceladas = await cancelarOtrasReservasDeLaObra(conexion, lector.id_lector, ejemplar.id_libro, idReservaCumplida);

    return `Prestado «${ejemplar.titulo}» (${codigo}) a ${lector.nombre}. Vence el ${fechaCorta(vence)}.` +
      (idReservaCumplida ? " Su reserva quedó cumplida." : "") +
      (canceladas > 0 ? " Se canceló su otra reserva de esta obra (RN-68)." : "");
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
    if (ejemplar.estado === "perdido") {
      throw new ErrorDeRegla(`El ejemplar ${codigo} está declarado perdido; su recuperación no está implementada todavía.`);
    }
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
  const idPrestamo = idDe(datos, "id_prestamo");
  if (!idPrestamo) return { error: "Préstamo no válido." };

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

// ---------------------------------------------------------------------
// Ubicar un ejemplar (RN-17, RN-20, RN-69)
// ---------------------------------------------------------------------
export async function ubicarEjemplar(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador("coleccion");
  const codigo = codigoDeBarras(datos);
  const idUbicacion = idDe(datos, "id_ubicacion");
  if (!codigo || !idUbicacion) return { error: "Elige un estante." };

  return operar({}, async (conexion) => {
    const ejemplar = await bloquearEjemplarPorCodigo(conexion, codigo);
    if (!ejemplar || ejemplar.id_sede !== empleado.idSede) throw new ErrorDeRegla(`El ejemplar ${codigo} no está en tu sede.`);
    if (ejemplar.estado !== "por_ubicar") throw new ErrorDeRegla(`El ejemplar ${codigo} ya no está por ubicar.`);
    // RN-17: solo ubicaciones del catálogo de la sede (el id viene del navegador: se comprueba).
    const etiqueta = await ubicacionEsDeSede(conexion, idUbicacion, empleado.idSede);
    if (!etiqueta) throw new ErrorDeRegla("Ese estante no es de tu sede.");

    await procesarReservasVencidas(conexion, ejemplar.id_libro, empleado.idSede); // RN-48
    // RN-69: si hay cola, queda apartado (con su estante ya asignado) en vez de disponible.
    const destino = await liberarEjemplar(conexion, ejemplar, "por_ubicar", empleado.idSede, { id: idUbicacion, etiqueta });
    return `${codigo} («${ejemplar.titulo}») ubicado en ${etiqueta}. Siguiente paso: ${destino}.`;
  });
}

// ---------------------------------------------------------------------
// Declarar perdido (RN-06, RN-49, RN-71)
// ---------------------------------------------------------------------
export async function declararPerdido(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador("coleccion");
  const idPrestamo = idDe(datos, "id_prestamo");
  if (!idPrestamo) return { error: "Préstamo no válido." };

  return operar({}, async (conexion) => {
    const prestamo = await bloquearPrestamoParaPerdido(conexion, idPrestamo);
    if (!prestamo || prestamo.id_sede_prestamo !== empleado.idSede) throw new ErrorDeRegla("Préstamo no encontrado en tu sede.");
    // RN-49: solo desde la lista calculada (más de dias_atraso_perdido días). Se vuelve a comprobar aquí.
    if (prestamo.dias_atraso <= prestamo.dias_atraso_perdido) {
      throw new ErrorDeRegla(`Solo se declara perdido con más de ${prestamo.dias_atraso_perdido} días de atraso.`);
    }
    const cambiado = await cambiarEstadoEjemplar(conexion, prestamo.id_ejemplar, "prestado", {
      estado: "perdido",
      idSede: empleado.idSede,
      idUbicacion: null,
    });
    if (!cambiado) throw new ErrorDeRegla("El ejemplar cambió de estado mientras se registraba. Vuelve a intentarlo.");
    // RN-06: multa de reposición. RN-71: el préstamo queda abierto pero ya no cuenta como vencido.
    await insertarMultaReposicion(conexion, prestamo.id_prestamo, prestamo.valor_reposicion);
    return `${prestamo.codigo_barras} («${prestamo.titulo}») declarado perdido. Multa de reposición para ${prestamo.lector}: ${pesos(prestamo.valor_reposicion)}.`;
  });
}
