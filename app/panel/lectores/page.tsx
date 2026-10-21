import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BotonAccion } from "@/components/boton-accion";
import { FormularioAnular, FormularioValidar } from "@/components/panel/formularios-mostrador";
import { ResumenDeLector } from "@/components/resumen-lector";
import { claseBoton, claseCampo, claseEtiqueta } from "@/components/ui-formulario";
import { cobrarMulta } from "@/lib/actions/multas";
import {
  buscarLectores,
  obtenerMultasDeLector,
  obtenerPrestamosDeLector,
  obtenerReservasDeLector,
  obtenerResumenLector,
  obtenerTiposDeLector,
} from "@/lib/data/lectores";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Lectores" };

// Mostrador: buscar a un lector (correo o documento), ver su situación, validarlo (D-03), cobrar sus multas
// (RN-66) y, si el rol lo permite, anularlas (RN-67). La búsqueda va en la URL (?q=, ?id=), como el catálogo.
export default async function PaginaLectores({ searchParams }: PageProps<"/panel/lectores">) {
  // Todo empleado entra: la administradora de red puede anular multas (RN-67) aunque no opere en mostrador.
  const empleado = await exigirEmpleado();
  const deMostrador = empleado.rol !== "admin_red";
  const puedeAnular = (idSedePrestamo: number) =>
    empleado.rol === "admin_red" || (empleado.rol === "coordinador" && idSedePrestamo === empleado.idSede);
  const { q, id } = await searchParams;
  const texto = typeof q === "string" ? q.trim().slice(0, 254) : "";
  const idLector = typeof id === "string" && /^\d+$/.test(id) ? Number(id) : null;

  const resultados = texto ? await buscarLectores(texto) : [];
  const elegido = idLector ?? (resultados.length === 1 ? resultados[0].id_lector : null);
  const [resumen, prestamos, multas, reservas, tipos] = elegido
    ? await Promise.all([
        obtenerResumenLector(elegido),
        obtenerPrestamosDeLector(elegido),
        obtenerMultasDeLector(elegido),
        obtenerReservasDeLector(elegido),
        obtenerTiposDeLector(),
      ])
    : [null, [], [], [], []];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lectores</h1>
        {/* next/form con GET: la búsqueda queda en la URL y funciona sin JavaScript */}
        <Form action="/panel/lectores" className="mt-4 flex max-w-xl items-end gap-3">
          <div className="flex-1">
            <label htmlFor="q" className={claseEtiqueta}>Correo o número de documento</label>
            <input id="q" name="q" defaultValue={texto} required className={claseCampo} />
          </div>
          <button type="submit" className={claseBoton}>Buscar</button>
        </Form>
      </div>

      {texto && resultados.length === 0 && <p className="text-sm text-zinc-500">No hay lectores con ese correo o documento.</p>}
      {resultados.length > 1 && !idLector && (
        <ul className="text-sm">
          {resultados.map((r) => (
            <li key={r.id_lector}><Link href={`/panel/lectores?id=${r.id_lector}`} className="underline">{r.nombre}</Link> · {r.correo}</li>
          ))}
        </ul>
      )}

      {resumen && (
        <div>
          <h2 className="text-xl font-semibold">{resumen.nombre}</h2>
          <p className="mb-4 text-sm text-zinc-500">
            {resumen.correo}{resumen.numero_documento && ` · ${resumen.tipo_documento} ${resumen.numero_documento}`} · {resumen.edad} años
          </p>
          {deMostrador && resumen.estado_cuenta === "verificada" && (
            <div className="mb-6 rounded-lg border border-amber-300 p-4 dark:border-amber-800">
              <p className="mb-3 text-sm font-medium">Validar con el documento original (D-03)</p>
              <FormularioValidar idLector={resumen.id_lector} tipos={tipos} />
            </div>
          )}
          <ResumenDeLector
            resumen={resumen}
            prestamos={prestamos}
            multas={multas}
            reservas={reservas}
            accionesMulta={(m) => (
              <>
                {deMostrador && (
                  <BotonAccion accion={cobrarMulta} campos={{ id_multa: m.id_multa }} etiqueta="Cobrar en efectivo"
                               etiquetaPendiente="Cobrando…" variante="principal" />
                )}
                {/* RN-67: el formulario solo se muestra a quien puede; la acción lo vuelve a comprobar. */}
                {puedeAnular(m.id_sede_prestamo) && <FormularioAnular idMulta={m.id_multa} />}
              </>
            )}
          />
        </div>
      )}
    </div>
  );
}
