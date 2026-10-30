import { redirect } from "next/navigation";
import { inicioDe } from "@/lib/permisos";
import { exigirEmpleado } from "@/lib/sesion";

// DI-10: /panel no es una pantalla, es la puerta. Cada rol entra a su sección: el mostrador quien atiende, los
// reportes el administrador de red (UX-07). Los enlaces "Panel" del menú y el login siguen apuntando aquí.
export default async function PaginaPanel() {
  const empleado = await exigirEmpleado(undefined, "/panel"); // RN-83
  redirect(inicioDe(empleado.rol));
}
