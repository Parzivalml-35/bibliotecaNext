import { NavegacionCuenta } from "@/components/cuenta/navegacion-cuenta";

// "Mi cuenta" (DI-10): el contenedor y las pestañas de todas sus páginas. Como el layout del panel, NO verifica la
// sesión: un layout no se vuelve a ejecutar al navegar entre sus páginas. Cada página llama a exigirLector() con
// su propia ruta (RN-35, RN-83). Este layout no lee la sesión ni cookies, así que no necesita <Suspense>.
// Sin <h1>: cada página pone el suyo, que coincide con el título de la pestaña del navegador.
export default function LayoutCuenta({ children }: LayoutProps<"/cuenta">) {
  return (
    // has-[[data-ancho=amplio]]:max-w-6xl: si adentro hay un elemento con data-ancho="amplio" (el layout de "Mis
    // lecturas"), el contenedor se ensancha. Selector CSS :has(): el padre cambia según lo que contiene, sin JavaScript
    // y sin que este layout sepa en qué página está.
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 has-[[data-ancho=amplio]]:max-w-6xl">
      <NavegacionCuenta />
      {children}
    </div>
  );
}
