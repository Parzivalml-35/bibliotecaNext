import type { Metadata } from "next";
import { BotonAccion } from "@/components/boton-accion";
import { EstadoVacio } from "@/components/estado-vacio";
import { EtiquetaPrestamo } from "@/components/etiqueta-prestamo";
import { renovarPrestamo } from "@/lib/actions/circulacion";
import { obtenerPrestamosAbiertos } from "@/lib/data/circulacion";
import { fechaCorta, plural } from "@/lib/formato";
import { tienePermiso } from "@/lib/permisos";
import { exigirEmpleado } from "@/lib/sesion";

export const metadata: Metadata = { title: "Préstamos abiertos" };

const NOMBRE_ROL = { bibliotecario: "Bibliotecario", coordinador: "Coordinador de sede", admin_red: "Administrador de red" };

export default async function PaginaMostrador() {
  // Primero la sesión: si no hay empleado, redirect() corta aquí y no se consulta nada más.
  const empleado = await exigirEmpleado("mostrador", "/panel/mostrador");

  // RN-34: cada empleado ve su sede; el administrador de red, toda la red.
  const prestamos = await obtenerPrestamosAbiertos(empleado.idSede);
  const puedeRenovar = tienePermiso(empleado.rol, "mostrador");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Préstamos abiertos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {NOMBRE_ROL[empleado.rol]} · {empleado.sede ?? "Toda la red"} · {plural(prestamos.length, "préstamo", "préstamos")}
      </p>

      {prestamos.length === 0 ? (
        <EstadoVacio className="mt-6">No hay préstamos abiertos.</EstadoVacio>
      ) : (
        // overflow-x-auto: en pantallas angostas la tabla se desplaza dentro de su caja, no la página entera.
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Ejemplar</th>
                <th scope="col" className="px-4 py-3">Lector</th>
                {empleado.idSede === null && <th scope="col" className="px-4 py-3">Sede</th>}
                <th scope="col" className="px-4 py-3">Vence</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                {puedeRenovar && <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {prestamos.map((p) => (
                <tr key={p.id_prestamo} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.titulo}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.codigo_barras}</div>
                  </td>
                  <td className="px-4 py-3">{p.lector}</td>
                  {empleado.idSede === null && <td className="px-4 py-3">{p.sede}</td>}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fechaCorta(p.fecha_vencimiento)}
                    {p.renovaciones > 0 && (
                      <div className="text-xs text-muted-foreground">{plural(p.renovaciones, "renovación", "renovaciones")}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {/* RN-76: el mismo aviso "por vencer" que ve el lector en su cuenta. */}
                    <EtiquetaPrestamo prestamo={p} />
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
