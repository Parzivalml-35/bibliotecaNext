import { NavegacionCuenta } from "@/components/cuenta/navegacion-cuenta";

// "Mi cuenta" (DI-10): el contenedor y las pestañas de todas sus páginas. Como el layout del panel, NO verifica la
// sesión: un layout no se vuelve a ejecutar al navegar entre sus páginas. Cada página llama a exigirLector() con
// su propia ruta (RN-35, RN-83). Este layout no lee la sesión ni cookies, así que no necesita <Suspense>.
// Sin <h1>: cada página pone el suyo, que coincide con el título de la pestaña del navegador.
export default function LayoutCuenta({ children }: LayoutProps<"/cuenta">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <NavegacionCuenta />
      {children}
    </div>
  );
}
