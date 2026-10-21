import type { Metadata } from "next";
import { BotonAccion } from "@/components/boton-accion";
import { renovarPrestamo } from "@/lib/actions/circulacion";
import { obtenerPrestamosAbiertos } from "@/lib/data/circulacion";
import { fechaCorta, plural } from "@/lib/formato";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Panel" };

const NOMBRE_ROL = { bibliotecario: "Bibliotecario", coordinador: "Coordinador de sede", admin_red: "Administrador de red" };

const MOTIVOS: Record<string, string> = {
  "sin-permiso": "Tu rol no permite esa operación.",
};

export default async function PaginaPanel({ searchParams }: PageProps<"/panel">) {
  // Primero la sesión: si no hay empleado, redirect() corta aquí y no se consulta nada más.
  const empleado = await exigirEmpleado();
  const { motivo } = await searchParams;
  const aviso = typeof motivo === "string" ? MOTIVOS[motivo] : undefined;

  // RN-34: cada empleado ve su sede; el administrador de red, toda la red.
  const prestamos = await obtenerPrestamosAbiertos(empleado.idSede);
  const puedeRenovar = empleado.rol !== "admin_red";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Préstamos abiertos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {NOMBRE_ROL[empleado.rol]} · {empleado.sede ?? "Toda la red"} · {plural(prestamos.length, "préstamo", "préstamos")}
      </p>
      {aviso && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}

      {prestamos.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center text-sm dark:border-zinc-700">
          No hay préstamos abiertos.
        </p>
      ) : (
        // overflow-x-auto: en pantallas angostas la tabla se desplaza dentro de su caja, no la página entera.
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th scope="col" className="px-4 py-3">Ejemplar</th>
                <th scope="col" className="px-4 py-3">Lector</th>
                {empleado.idSede === null && <th scope="col" className="px-4 py-3">Sede</th>}
                <th scope="col" className="px-4 py-3">Vence</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                {puedeRenovar && <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {prestamos.map((p) => (
                <tr key={p.id_prestamo} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.titulo}</div>
                    <div className="font-mono text-xs text-zinc-500">{p.codigo_barras}</div>
                  </td>
                  <td className="px-4 py-3">{p.lector}</td>
                  {empleado.idSede === null && <td className="px-4 py-3">{p.sede}</td>}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fechaCorta(p.fecha_vencimiento)}
                    {p.renovaciones > 0 && (
                      <div className="text-xs text-zinc-500">{plural(p.renovaciones, "renovación", "renovaciones")}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.dias_atraso > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                        Vencido · {plural(p.dias_atraso, "día", "días")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        Al día
                      </span>
                    )}
                  </td>
                  {puedeRenovar && (
                    <td className="px-4 py-3">
                      <BotonAccion accion={renovarPrestamo} campos={{ id_prestamo: p.id_prestamo }} etiqueta="Renovar" etiquetaPendiente="Renovando…" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
