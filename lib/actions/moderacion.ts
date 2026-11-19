"use server";

import { revalidatePath } from "next/cache";
import { bloquearResena, descartarReportes, mostrarResena, ocultarResena } from "@/lib/data/resenas";
import type { EstadoFormulario } from "@/lib/definitions";
import { ErrorDeRegla, idDe, operar } from "@/lib/actions/reglas";
import { exigirEmpleado } from "@/lib/sesion";

// RN-95: la moderación de reseñas en el panel. El permiso `lectores` (lib/permisos.ts) lo verifica exigirEmpleado en
// CADA acción (RN-35): que la página no muestre el botón no impide llamar la acción. Los botones son BotonAccion (un
// formulario con el id en un campo oculto): el id se vuelve a comprobar aquí, bloqueando la reseña.
// Rutas a revalidar: el panel y la ficha del libro (el promedio y la lista cambian para todos).

export async function ocultarResenaReportada(_estado: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await exigirEmpleado("lectores");
  const idResena = idDe(datos, "id_resena");
  if (!idResena) return { error: "Reseña no válida." };
  let isbn = "";
  const resultado = await operar({}, async (conexion) => {
    const resena = await bloquearResena(conexion, idResena);
    if (!resena) throw new ErrorDeRegla("Esa reseña ya no existe (su autor la borró).");
    if (resena.oculta) throw new ErrorDeRegla("Esa reseña ya estaba oculta.");
    isbn = resena.isbn;
    const resueltos = await ocultarResena(conexion, idResena, empleado.idEmpleado);
    return `Reseña oculta. ${resueltos === 1 ? "Se resolvió 1 reporte" : `Se resolvieron ${resueltos} reportes`}.`;
  }, ["/panel"]);
  return revalidarFicha(resultado, isbn);
}

export async function descartarReportesDeResena(_estado: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const empleado = await exigirEmpleado("lectores");
  const idResena = idDe(datos, "id_resena");
  if (!idResena) return { error: "Reseña no válida." };
  return operar({}, async (conexion) => {
    const resena = await bloquearResena(conexion, idResena);
    if (!resena) throw new ErrorDeRegla("Esa reseña ya no existe (su autor la borró).");
    const resueltos = await descartarReportes(conexion, idResena, empleado.idEmpleado);
    if (resueltos === 0) throw new ErrorDeRegla("No le quedan reportes pendientes.");
    return `Reportes descartados (${resueltos}). La reseña sigue publicada.`;
  }, ["/panel"]);
}

export async function volverAMostrarResena(_estado: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  await exigirEmpleado("lectores");
  const idResena = idDe(datos, "id_resena");
  if (!idResena) return { error: "Reseña no válida." };
  let isbn = "";
  const resultado = await operar({}, async (conexion) => {
    const resena = await bloquearResena(conexion, idResena);
    if (!resena) throw new ErrorDeRegla("Esa reseña ya no existe (su autor la borró).");
    if (!resena.oculta) throw new ErrorDeRegla("Esa reseña ya estaba publicada.");
    isbn = resena.isbn;
    await mostrarResena(conexion, idResena);
    return "La reseña vuelve a estar publicada.";
  }, ["/panel"]);
  return revalidarFicha(resultado, isbn);
}

// La ficha del libro también cambia (promedio y lista). Se revalida solo si la operación salió bien: `isbn` lo llenó
// el trabajo dentro de la transacción.
// Sin export: en un archivo "use server" cada export se vuelve una acción que el navegador puede llamar.
function revalidarFicha(resultado: EstadoFormulario, isbn: string): EstadoFormulario {
  if (resultado.exito && isbn) revalidatePath(`/libros/${isbn}`);
  return resultado;
}
