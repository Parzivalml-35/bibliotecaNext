"use server";

import type { PoolConnection } from "mysql2/promise";
import { situacionDelLector } from "@/lib/data/circulacion";
import {
  bloquearAccesoAlTitulo,
  bloquearLectorDigital,
  bloquearPrestamoDigital,
  bloquearReservaDigitalPorId,
  bloquearReservaDigitalViva,
  cancelarReservaDigital,
  cumplirReservaDigital,
  insertarPrestamoDigital,
  insertarReservaDigital,
  posicionEnColaDigital,
  registrarDevolucionDigital,
  situacionDigitalDelLector,
} from "@/lib/data/digital";
import { obtenerLibroPorIsbn } from "@/lib/data/libros";
import type { EstadoFormulario, LibroDetalle } from "@/lib/definitions";
import { elegirLote, ErrorDeRegla, idDe, licenciasLibres, operar, procesarColaDigital, texto } from "@/lib/actions/reglas";
import { esIsbnValido } from "@/lib/isbn";
import { exigirLector } from "@/lib/sesion";

// Préstamo digital desde la web (RN-25 a RN-30, RN-43, RN-44, RN-46, RN-48, RN-55, RN-56).
// El lector sale SIEMPRE de la sesión; el formulario solo dice qué título, préstamo o reserva.
// Todo lo exportado aquí es un endpoint público; los ayudantes viven en lib/actions/reglas.ts.

const rutasDe = (isbn: string) => ["/cuenta", `/libros/${isbn}`, "/panel"];

// Condiciones comunes para pedir un préstamo o una reserva digital. Bloquea al lector (primer candado del orden).
async function lectorQuePuedePedir(conexion: PoolConnection, idCuenta: number, libro: LibroDetalle) {
  const lector = await bloquearLectorDigital(conexion, idCuenta);
  if (!lector) throw new ErrorDeRegla("Tu cuenta no puede pedir libros digitales.");
  // D-02, RN-32: basta la cuenta verificada; no hay nada físico que entregar.
  if (!lector.verificada) throw new ErrorDeRegla("Verifica tu correo para leer libros digitales.");
  // RN-43: bloqueado no pide préstamos ni reservas (lo que ya tiene lo sigue leyendo).
  const situacion = await situacionDelLector(conexion, lector.id_lector);
  if (situacion.vencidos > 0) throw new ErrorDeRegla("Tienes préstamos vencidos: devuélvelos para pedir libros digitales.");
  if (situacion.multasPendientes > 0) throw new ErrorDeRegla("Tienes multas pendientes: págalas para pedir libros digitales.");
  // RN-46: la clasificación del libro manda.
  if (lector.edad < libro.edad_minima) throw new ErrorDeRegla(`Este libro es para ${libro.clasificacion}.`);
  // Ya lo puede leer: no tiene sentido gastar otra licencia.
  const acceso = await bloquearAccesoAlTitulo(conexion, lector.id_lector, libro.id_libro);
  if (acceso.compra) throw new ErrorDeRegla("Ya compraste este libro: puedes leerlo cuando quieras.");
  if (acceso.prestamo) throw new ErrorDeRegla("Ya tienes este libro prestado.");
  return lector;
}

async function libroDelFormulario(datos: FormData) {
  const isbn = texto(datos, "isbn");
  if (!esIsbnValido(isbn)) return null;
  return obtenerLibroPorIsbn(isbn);
}

// Pedir el préstamo. Sirve también para CONFIRMAR una reserva asignada (RN-28) y para "tomar el turno" cuando
// el lector es el primero de la cola y hay una licencia libre que nadie ha asignado todavía (la cola se procesa
// aquí mismo, antes de decidir).
export async function prestarDigital(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lectorSesion = await exigirLector();
  const libro = await libroDelFormulario(datos);
  if (!libro) return { error: "Ese libro no existe." };

  return operar(
    {},
    async (conexion) => {
      const lector = await lectorQuePuedePedir(conexion, lectorSesion.idCuenta, libro);
      const lotes = await procesarColaDigital(conexion, libro.id_libro, libro.titulo); // RN-48, RN-28
      if (lotes.length === 0) throw new ErrorDeRegla("Este libro no tiene licencias digitales vigentes.");

      const { prestamosVigentes } = await situacionDigitalDelLector(conexion, lector.id_lector);
      if (prestamosVigentes >= lector.max_prestamos_digitales) {
        throw new ErrorDeRegla(`Ya tienes ${prestamosVigentes} de ${lector.max_prestamos_digitales} préstamos digitales: devuelve uno para pedir otro.`);
      }

      // ¿Tiene una reserva asignada (quizá recién asignada por procesarColaDigital)? Usa SU licencia retenida.
      const reserva = await bloquearReservaDigitalViva(conexion, lector.id_lector, libro.id_libro);
      if (reserva?.estado === "asignada" && reserva.vigente && reserva.id_licencia !== null) {
        const prestamo = await insertarPrestamoDigital(conexion, lector.id_lector, reserva.id_licencia, lector.dias_prestamo_digital);
        await cumplirReservaDigital(conexion, reserva.id_reserva_digital, prestamo.idPrestamo);
        return `Reserva confirmada: ya puedes leerlo hasta el ${prestamo.fin}.`;
      }
      // RN-28: con gente en cola, las licencias que se liberan ya se asignaron arriba; esperar es entrar a la cola.
      if (reserva?.estado === "activa") throw new ErrorDeRegla("Todavía no es tu turno: te avisamos cuando se libere una licencia.");

      const lote = elegirLote(lotes, lector.dias_prestamo_digital); // RN-55
      if (!lote) throw new ErrorDeRegla("No hay licencias libres en este momento: resérvalo y te avisamos.");
      const prestamo = await insertarPrestamoDigital(conexion, lector.id_lector, lote.id_licencia, lector.dias_prestamo_digital);
      return `Préstamo listo: puedes leerlo hasta el ${prestamo.fin}.`;
    },
    rutasDe(libro.isbn),
  );
}

// RN-28: la reserva digital es sobre la obra, sin sede. Solo si no hay licencias libres (si las hay, se presta).
export async function reservarDigital(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lectorSesion = await exigirLector();
  const libro = await libroDelFormulario(datos);
  if (!libro) return { error: "Ese libro no existe." };

  return operar(
    {},
    async (conexion) => {
      const lector = await lectorQuePuedePedir(conexion, lectorSesion.idCuenta, libro);
      const lotes = await procesarColaDigital(conexion, libro.id_libro, libro.titulo);
      if (lotes.length === 0) throw new ErrorDeRegla("Este libro no tiene licencias digitales vigentes.");
      if (licenciasLibres(lotes) > 0) throw new ErrorDeRegla("Hay una licencia libre: puedes pedirlo prestado ahora mismo.");

      const { reservasVivas } = await situacionDigitalDelLector(conexion, lector.id_lector);
      if (reservasVivas >= lector.max_reservas_digitales) { // RN-45
        throw new ErrorDeRegla(`Ya tienes ${reservasVivas} de ${lector.max_reservas_digitales} reservas digitales permitidas.`);
      }
      let idReserva: number;
      try {
        idReserva = await insertarReservaDigital(conexion, lector.id_lector, libro.id_libro);
      } catch (error) {
        // uq_reserva_digital_viva: una sola reserva viva por lector y título (también frena dos clics).
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new ErrorDeRegla("Ya tienes una reserva de este libro.");
        throw error;
      }
      return `Reservado. Estás en el puesto ${await posicionEnColaDigital(conexion, idReserva)} de la cola; te avisamos por correo.`;
    },
    rutasDe(libro.isbn),
  );
}

// RN-27: devolver antes libera la licencia, que pasa de inmediato al primero de la cola (RN-28).
export async function devolverDigital(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lectorSesion = await exigirLector();
  const idPrestamo = idDe(datos, "id_prestamo_digital");
  const isbn = texto(datos, "isbn");
  if (!idPrestamo || !esIsbnValido(isbn)) return { error: "Préstamo no válido." };
  const libro = await obtenerLibroPorIsbn(isbn);
  if (!libro) return { error: "Préstamo no válido." };

  return operar(
    {},
    async (conexion) => {
      // Orden: lector → lotes → (préstamo y reservas). Primero el lector, aunque solo se use para comprobar el dueño.
      const lector = await bloquearLectorDigital(conexion, lectorSesion.idCuenta);
      await procesarColaDigital(conexion, libro.id_libro, libro.titulo); // bloquea los lotes del título
      const prestamo = await bloquearPrestamoDigital(conexion, idPrestamo);
      // Dueño y título comprobados en el servidor: el id y el ISBN del formulario podrían ser de otro.
      if (!lector || !prestamo || prestamo.id_lector !== lector.id_lector || prestamo.id_libro !== libro.id_libro) {
        throw new ErrorDeRegla("Préstamo no encontrado.");
      }
      if (!prestamo.vigente || !(await registrarDevolucionDigital(conexion, idPrestamo))) {
        throw new ErrorDeRegla("Ese préstamo ya terminó.");
      }
      await procesarColaDigital(conexion, libro.id_libro, libro.titulo); // la licencia liberada, al primero de la cola
      return "Devuelto. Gracias: la licencia queda para otro lector.";
    },
    rutasDe(libro.isbn),
  );
}

// El lector cancela su reserva digital. Si estaba asignada, su licencia pasa al siguiente (RN-28).
export async function cancelarReservaDigitalPropia(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lectorSesion = await exigirLector();
  const idReserva = idDe(datos, "id_reserva_digital");
  const isbn = texto(datos, "isbn");
  if (!idReserva || !esIsbnValido(isbn)) return { error: "Reserva no válida." };
  const libro = await obtenerLibroPorIsbn(isbn);
  if (!libro) return { error: "Reserva no válida." };

  return operar(
    {},
    async (conexion) => {
      const lector = await bloquearLectorDigital(conexion, lectorSesion.idCuenta);
      await procesarColaDigital(conexion, libro.id_libro, libro.titulo);
      const reserva = await bloquearReservaDigitalPorId(conexion, idReserva);
      if (!lector || !reserva || reserva.id_lector !== lector.id_lector || reserva.id_libro !== libro.id_libro) {
        throw new ErrorDeRegla("Reserva no encontrada.");
      }
      if (reserva.estado !== "activa" && reserva.estado !== "asignada") throw new ErrorDeRegla("Esa reserva ya está cerrada.");
      await cancelarReservaDigital(conexion, idReserva);
      if (reserva.estado === "asignada") await procesarColaDigital(conexion, libro.id_libro, libro.titulo);
      return "Reserva cancelada.";
    },
    rutasDe(libro.isbn),
  );
}
