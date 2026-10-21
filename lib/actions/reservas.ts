"use server";

import {
  bloquearCopiaDisponible,
  bloquearLectorPorCuenta,
  bloquearPrimeraEnCola,
  bloquearReservaPorId,
  cambiarEstadoEjemplar,
  insertarReserva,
  posicionEnCola,
  situacionDelLector,
  tienePrestadaLaObra,
} from "@/lib/data/circulacion";
import { obtenerLibroPorIsbn } from "@/lib/data/libros";
import type { EstadoFormulario } from "@/lib/definitions";
import { cancelarYLiberar, ErrorDeRegla, idDe, operar, procesarReservasVencidas, texto } from "@/lib/actions/reglas";
import { esIsbnValido } from "@/lib/isbn";
import { exigirLector } from "@/lib/sesion";

// Reservas físicas desde la web (RN-07 a RN-12, RN-43, RN-45, RN-46, RN-48, RN-68, RN-72).
// El lector se toma SIEMPRE de la sesión: el formulario solo dice qué obra y qué sede.

export async function reservarObra(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lectorSesion = await exigirLector();
  const isbn = texto(datos, "isbn");
  const idSede = idDe(datos, "id_sede");
  if (!esIsbnValido(isbn) || !idSede) return { error: "Elige una sede." };
  const libro = await obtenerLibroPorIsbn(isbn);
  if (!libro) return { error: "Ese libro no existe." };

  return operar(
    {},
    async (conexion) => {
      // Orden de bloqueo: lector → reservas/ejemplares de la obra (el préstamo bloquea ejemplar → lector,
      // pero aquí no hay ejemplar elegido hasta el final, y el que se elige está disponible: no compiten).
      const lector = await bloquearLectorPorCuenta(conexion, lectorSesion.idCuenta);
      if (!lector) throw new ErrorDeRegla("Tu cuenta no puede reservar.");
      // RN-32, RN-72: verificada basta; la validación en mostrador solo se exige para llevarse el libro.
      if (!lector.verificada) throw new ErrorDeRegla("Verifica tu correo antes de reservar.");
      const situacion = await situacionDelLector(conexion, lector.id_lector);
      // RN-43: bloqueado no reserva.
      if (situacion.vencidos > 0) throw new ErrorDeRegla("Tienes préstamos vencidos: devuélvelos para poder reservar.");
      if (situacion.multasPendientes > 0) throw new ErrorDeRegla("Tienes multas pendientes: págalas para poder reservar.");
      // RN-12, RN-45
      if (situacion.reservasVivas >= lector.max_reservas_fisicas) {
        throw new ErrorDeRegla(`Ya tienes ${situacion.reservasVivas} de ${lector.max_reservas_fisicas} reservas permitidas.`);
      }
      // RN-46
      if (lector.edad < libro.edad_minima) throw new ErrorDeRegla(`Este libro es para ${libro.clasificacion}.`);
      // RN-68
      if (await tienePrestadaLaObra(conexion, lector.id_lector, libro.id_libro)) {
        throw new ErrorDeRegla("Ya tienes este libro prestado.");
      }

      await procesarReservasVencidas(conexion, libro.id_libro, idSede); // RN-48

      // RN-09: si hay copia disponible y nadie en cola, se aparta de inmediato; si no, a la cola.
      const hayCola = (await bloquearPrimeraEnCola(conexion, libro.id_libro, idSede)) !== null;
      const copia = hayCola ? null : await bloquearCopiaDisponible(conexion, libro.id_libro, idSede);
      if (copia !== null) {
        // Apartado conserva su estante: cambiarEstadoEjemplar escribe todas las columnas.
        const apartada = await cambiarEstadoEjemplar(conexion, copia.id_ejemplar, "disponible", {
          estado: "apartado",
          idSede,
          idUbicacion: copia.id_ubicacion,
        });
        if (!apartada) throw new ErrorDeRegla("La copia cambió de estado. Vuelve a intentarlo.");
      }

      let idReserva: number;
      try {
        idReserva = await insertarReserva(conexion, {
          idLector: lector.id_lector,
          idLibro: libro.id_libro,
          idSede,
          idEjemplar: copia?.id_ejemplar ?? null,
          diasParaRecoger: lector.dias_recoger_reserva,
        });
      } catch (error) {
        // uq_reserva_viva: una sola reserva viva por lector y obra (también protege de dos clics simultáneos).
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") throw new ErrorDeRegla("Ya tienes una reserva de este libro.");
        throw error;
      }

      if (copia !== null) {
        return `Reservado. Hay una copia apartada para ti: tienes ${lector.dias_recoger_reserva} días para recogerla.`;
      }
      return `Reservado. Estás en el puesto ${await posicionEnCola(conexion, idReserva)} de la cola de esa sede.`;
    },
    ["/cuenta", `/libros/${isbn}`, "/panel"],
  );
}

// RN-10: el lector puede cancelar antes de recoger. Si estaba asignada, la copia pasa al siguiente.
export async function cancelarMiReserva(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lectorSesion = await exigirLector();
  const idReserva = idDe(datos, "id_reserva");
  if (!idReserva) return { error: "Reserva no válida." };

  return operar(
    {},
    async (conexion) => {
      const reserva = await bloquearReservaPorId(conexion, idReserva);
      // Dueño comprobado contra la sesión: el id del navegador podría ser de otra persona.
      if (!reserva || reserva.id_lector !== lectorSesion.idLector) throw new ErrorDeRegla("Reserva no encontrada.");
      if (reserva.estado !== "activa" && reserva.estado !== "asignada") throw new ErrorDeRegla("Esa reserva ya está cerrada.");
      await cancelarYLiberar(conexion, reserva);
      return "Reserva cancelada.";
    },
    ["/cuenta", "/panel", "/"],
  );
}
