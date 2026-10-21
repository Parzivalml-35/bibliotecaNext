"use server";

import { redirect } from "next/navigation";
import { enTransaccion } from "@/lib/db";
import {
  anularMulta,
  bloquearMulta,
  cerrarPagoEnLinea,
  insertarPagoEnMostrador,
  marcarMultaPagada,
  obtenerOCrearPagoEnLinea,
  obtenerPago,
} from "@/lib/data/multas";
import type { EstadoFormulario } from "@/lib/definitions";
import { pesos } from "@/lib/formato";
import { empleadoDeMostrador, ErrorDeRegla, idDe, operar, texto } from "@/lib/actions/reglas";
import { exigirEmpleado, exigirLector } from "@/lib/sesion";

// Pago y anulación de multas (RN-66, RN-67, D-07). Al pagar, el lector se desbloquea solo (RN-03):
// el bloqueo se calcula, no hay nada más que actualizar.

const RUTAS = ["/panel", "/cuenta"];

// RN-66, en mostrador: lo registra un empleado de cualquier sede; queda su nombre y su sede en `pago`.
export async function cobrarMulta(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await empleadoDeMostrador();
  const idMulta = idDe(datos, "id_multa");
  if (!idMulta) return { error: "Multa no válida." };

  return operar(
    {},
    async (conexion) => {
      const multa = await bloquearMulta(conexion, idMulta);
      if (!multa) throw new ErrorDeRegla("Multa no encontrada.");
      if (multa.estado !== "pendiente") throw new ErrorDeRegla(`Esa multa ya está ${multa.estado}.`);
      if (!(await marcarMultaPagada(conexion, idMulta))) throw new ErrorDeRegla("La multa cambió de estado. Vuelve a intentarlo.");
      await insertarPagoEnMostrador(conexion, idMulta, multa.monto, empleado.idEmpleado, empleado.idSede);
      return `Cobrado: ${pesos(multa.monto)} («${multa.titulo}»).`;
    },
    RUTAS,
  );
}

// RN-67: solo coordinador (de la sede del préstamo) o administrador de red, con motivo obligatorio.
export async function anularMultaConMotivo(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await exigirEmpleado(["coordinador", "admin_red"]);
  const idMulta = idDe(datos, "id_multa");
  const motivo = texto(datos, "motivo");
  const valores = { motivo };
  if (!idMulta) return { error: "Multa no válida." };
  if (motivo.length < 10 || motivo.length > 255) return { error: "Escribe el motivo (entre 10 y 255 caracteres).", valores };

  return operar(
    valores,
    async (conexion) => {
      const multa = await bloquearMulta(conexion, idMulta);
      if (!multa) throw new ErrorDeRegla("Multa no encontrada.");
      if (empleado.rol === "coordinador" && multa.id_sede_prestamo !== empleado.idSede) {
        throw new ErrorDeRegla("Solo el coordinador de la sede donde se hizo el préstamo puede anular esta multa.");
      }
      if (multa.estado !== "pendiente") throw new ErrorDeRegla(`Esa multa ya está ${multa.estado}: no se puede anular.`);
      if (!(await anularMulta(conexion, idMulta, empleado.idEmpleado, motivo))) {
        throw new ErrorDeRegla("La multa cambió de estado. Vuelve a intentarlo.");
      }
      return `Multa de ${pesos(multa.monto)} anulada.`;
    },
    RUTAS,
  );
}

// RN-66, en línea: el lector inicia un pago simulado y va a la "pasarela" (D-07).
export async function pagarMultaEnLinea(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lector = await exigirLector();
  if (!lector.verificada) return { error: "Verifica tu correo antes de pagar en línea." };
  const idMulta = idDe(datos, "id_multa");
  if (!idMulta) return { error: "Multa no válida." };

  let idPago: number;
  try {
    idPago = await enTransaccion(async (conexion) => {
      const multa = await bloquearMulta(conexion, idMulta);
      // Dueño comprobado contra la sesión: el id_multa del navegador podría ser de otra persona.
      if (!multa || multa.id_cuenta_lector !== lector.idCuenta) throw new ErrorDeRegla("Multa no encontrada.");
      if (multa.estado !== "pendiente") throw new ErrorDeRegla(`Esa multa ya está ${multa.estado}.`);
      return obtenerOCrearPagoEnLinea(conexion, idMulta, multa.monto);
    });
  } catch (error) {
    if (error instanceof ErrorDeRegla) return { error: error.message };
    console.error("Error al iniciar un pago:", error);
    return { error: "No se pudo iniciar el pago. Inténtalo de nuevo." };
  }
  redirect(`/cuenta/pago/${idPago}`); // fuera del try: redirect() lanza
}

// La "pasarela" simulada responde aprobado o rechazado. Con una pasarela real, esto lo haría su
// notificación al servidor (webhook), nunca un botón en el navegador del lector.
export async function confirmarPagoSimulado(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const lector = await exigirLector();
  const idPago = idDe(datos, "id_pago");
  const resultado = texto(datos, "resultado");
  if (!idPago || (resultado !== "aprobado" && resultado !== "rechazado")) return { error: "Pago no válido." };

  return operar(
    {},
    async (conexion) => {
      const pago = await obtenerPago(conexion, idPago, true);
      if (!pago || pago.id_multa === null || pago.id_cuenta_lector !== lector.idCuenta) throw new ErrorDeRegla("Pago no encontrado.");
      if (pago.estado !== "pendiente") throw new ErrorDeRegla(`Ese pago ya está ${pago.estado}.`);

      if (resultado === "rechazado") {
        await cerrarPagoEnLinea(conexion, idPago, "fallido");
        return "La pasarela rechazó el pago. Puedes intentarlo de nuevo.";
      }
      // La multa pudo pagarse en mostrador o anularse mientras tanto: entonces este pago no procede.
      const multa = await bloquearMulta(conexion, pago.id_multa);
      if (!multa || !(await marcarMultaPagada(conexion, pago.id_multa))) {
        await cerrarPagoEnLinea(conexion, idPago, "fallido");
        return `La multa ya estaba ${multa?.estado ?? "cerrada"}: no se cobró nada.`;
      }
      await cerrarPagoEnLinea(conexion, idPago, "pagado");
      return `Pago aprobado: ${pesos(pago.monto)}. La multa quedó pagada.`;
    },
    RUTAS,
  );
}
