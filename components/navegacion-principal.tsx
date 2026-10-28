import { MenuMovil, type Pestana, PestanasPrincipales } from "@/components/pestanas-principales";
import { obtenerUsuario } from "@/lib/sesion";

// DI-02, DI-10: Catálogo para todos, "Mi cuenta" si la cuenta es de lector y "Panel" si es de empleado.
// Server Component asíncrono: el layout lo usa dos veces (barra y menú del celular), cada una en su <Suspense>.
// obtenerUsuario() está envuelta en cache(): las dos llamadas consultan la BD una sola vez por petición.
// Mostrar u ocultar pestañas es comodidad: cada página verifica la sesión por su cuenta (RN-35).
export async function NavegacionPrincipal({ variante }: { variante: "barra" | "movil" }) {
  const usuario = await obtenerUsuario();

  const pestanas: Pestana[] = [{ titulo: "Catálogo", ruta: "/", tambien: ["/libros"] }];
  if (usuario?.lector) pestanas.push({ titulo: "Mi cuenta", ruta: "/cuenta" });
  if (usuario?.empleado) pestanas.push({ titulo: "Panel", ruta: "/panel" });

  return variante === "barra" ? <PestanasPrincipales pestanas={pestanas} /> : <MenuMovil pestanas={pestanas} />;
}
