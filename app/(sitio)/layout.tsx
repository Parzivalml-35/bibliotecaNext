import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BotonTema } from "@/components/boton-tema";
import { MenuUsuario } from "@/components/menu-usuario";
import { NavegacionPrincipal } from "@/components/navegacion-principal";

// Route group "(sitio)": los paréntesis no forman parte de la URL (app/(sitio)/libros/[isbn] sigue siendo /libros/…).
// Sirve para que todas las páginas de la app compartan esta barra y el visor (app/leer) quede fuera
// (guía route-groups.md: "Opting specific route segments into sharing a layout, while keeping others out").
export default function LayoutSitio({ children }: { children: ReactNode }) {
  return (
    <>
      {/* DI-02: barra superior compartida. Logo · pestañas en píldora · tema · menú de usuario.
          En el celular las pestañas pasan al menú lateral. */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {/* Sin fallback: el botón del menú aparece cuando se resuelve la sesión (un instante). */}
          <Suspense fallback={null}>
            <NavegacionPrincipal variante="movil" />
          </Suspense>
          <Link href="/" className="mr-4 font-heading text-lg font-semibold tracking-tight">
            Biblioteca Next
          </Link>
          <Suspense fallback={null}>
            <NavegacionPrincipal variante="barra" />
          </Suspense>
          {/* ml-auto: el margen izquierdo automático empuja este grupo al extremo derecho del flex. */}
          <div className="ml-auto flex items-center gap-2">
            <BotonTema />
            {/* Sin fallback visible: mientras se lee la sesión, el espacio queda vacío un instante. */}
            <Suspense fallback={null}>
              <MenuUsuario />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
