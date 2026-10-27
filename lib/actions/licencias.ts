"use server";

import { bloquearColaDigital, existeEdicionPdf, insertarLote } from "@/lib/data/digital";
import { obtenerLibroPorIsbn } from "@/lib/data/libros";
import type { EstadoFormulario } from "@/lib/definitions";
import { ErrorDeRegla, operar, procesarColaDigital, texto } from "@/lib/actions/reglas";
import { esIsbnValido } from "@/lib/isbn";
import { exigirEmpleado } from "@/lib/sesion";

// RN-25, RN-33, RN-54: el administrador de red registra lotes de licencias de un título.
// Todo lo exportado aquí es un endpoint público: el rol se comprueba aquí, no en la página.

// "AAAA-MM-DD" que existe en el calendario (rechaza 2026-02-31).
const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && new Date(`${f}T00:00:00Z`).toISOString().slice(0, 10) === f;

export async function registrarLote(_estadoAnterior: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await exigirEmpleado("red");
  const isbn = texto(datos, "isbn");
  const cantidad = Number(texto(datos, "cantidad"));
  const adquisicion = texto(datos, "fecha_adquisicion");
  const vencimiento = texto(datos, "fecha_vencimiento");
  const valores = { isbn, cantidad: texto(datos, "cantidad"), fecha_adquisicion: adquisicion, fecha_vencimiento: vencimiento };

  if (!esIsbnValido(isbn)) return { error: "Elige un título.", valores };
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) return { error: "La cantidad va de 1 a 1000 licencias.", valores };
  const hoy = new Date().toISOString().slice(0, 10);
  if (!esFecha(adquisicion) || adquisicion > hoy) return { error: "La fecha de adquisición no es válida (no puede ser futura).", valores };
  if (vencimiento && (!esFecha(vencimiento) || vencimiento <= adquisicion || vencimiento <= hoy)) {
    return { error: "El vencimiento debe ser posterior a la adquisición y a hoy (o déjalo vacío si no vence).", valores };
  }
  const libro = await obtenerLibroPorIsbn(isbn);
  if (!libro) return { error: "Ese título no existe.", valores };

  return operar(
    valores,
    async (conexion) => {
      // RN-54: un lote sin archivo no se puede leer.
      if (!(await existeEdicionPdf(conexion, libro.id_libro))) throw new ErrorDeRegla("Ese título no tiene edición PDF.");
      // Mismo orden de bloqueo que el resto del módulo: primero los lotes del título (procesarColaDigital los
      // bloquea), así el lote nuevo no se cuenta a medias mientras otro lector pide una licencia.
      await procesarColaDigital(conexion, libro.id_libro, libro.titulo);
      const enColaAntes = (await bloquearColaDigital(conexion, libro.id_libro)).length;
      await insertarLote(conexion, {
        idLibro: libro.id_libro, cantidad, adquisicion, vencimiento: vencimiento || null, idEmpleado: empleado.idEmpleado,
      });
      // RN-28: las licencias nuevas van primero a la cola, con aviso por correo.
      await procesarColaDigital(conexion, libro.id_libro, libro.titulo);
      const asignadas = enColaAntes - (await bloquearColaDigital(conexion, libro.id_libro)).length;
      return asignadas > 0
        ? `Lote registrado: ${cantidad} licencias de «${libro.titulo}»; ${asignadas} se asignaron a la cola.`
        : `Lote registrado: ${cantidad} licencias de «${libro.titulo}».`;
    },
    ["/panel/red/licencias", `/libros/${isbn}`, "/cuenta"],
  );
}
