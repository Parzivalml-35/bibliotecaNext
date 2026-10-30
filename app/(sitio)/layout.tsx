import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BotonLampara } from "@/components/boton-lampara";
import { Logo } from "@/components/marca/iconos";
import { MenuUsuario } from "@/components/menu-usuario";
import { NavegacionPrincipal } from "@/components/navegacion-principal";

// Route group "(sitio)": los paréntesis no forman parte de la URL (app/(sitio)/libros/[isbn] sigue siendo /libros/…).
// Sirve para que todas las páginas de la app compartan esta barra y el visor (app/leer) quede fuera
// (guía route-groups.md: "Opting specific route segments into sharing a layout, while keeping others out").
export default function LayoutSitio({ children }: { children: ReactNode }) {
  return (
    <>
      {/* DI-02: barra flotante. sticky top-3: acompaña al desplazarse, separada 0.75rem del borde. z-40: por encima
          del contenido y por debajo de los menús de Radix (z-50). El <header> es transparente: solo la cápsula
          tiene fondo, así la luz de la pared (DI-14) se ve alrededor. */}
      <header className="sticky top-3 z-40 mt-3 px-4 sm:px-6 lg:px-8">
        {/* La cápsula. bg-card/85 + backdrop-blur: deja intuir lo que pasa por detrás al desplazarse, sin perder
            contraste (el texto va sobre un fondo casi opaco). Grilla de tres columnas 1fr · auto · 1fr: las dos de los
            lados miden lo mismo, así las pestañas quedan en el centro exacto aunque el logo y el login midan distinto. */}
        <div className="relative mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-full border border-border bg-card/85 py-1.5 pr-2 backdrop-blur">
          {/* Columna izquierda. pl-*: el hueco que ocupa el emblema. */}
          <div className="flex items-center pl-16 sm:pl-20">
            {/* DI-13: el emblema cuelga de la cápsula. absolute + top-1/2 + -translate-y-1/2: centrado en su alto;
                como es más alto que la barra (56 px de ancho → 70 px de alto en 4:5, frente a ~48 px), sobresale
                arriba y abajo. Es el enlace al inicio: su nombre accesible es el texto sr-only. */}
            <Link href="/" className="absolute top-1/2 left-3 -translate-y-1/2 rounded-md sm:left-4">
              <Logo className="w-11 sm:w-14" />
              <span className="sr-only">Biblioteca Next, ir al catálogo</span>
            </Link>
            {/* El nombre junto al emblema desde sm; en el celular falta espacio y el emblema basta. aria-hidden: el
                enlace del emblema ya dice el nombre. */}
            <span aria-hidden="true" className="hidden font-heading text-lg font-semibold tracking-tight whitespace-nowrap sm:inline">
              Biblioteca Next
            </span>
          </div>
          {/* Columna central: las pestañas (desde md; en el celular van al menú lateral). */}
          <Suspense fallback={null}>
            <NavegacionPrincipal variante="barra" />
          </Suspense>
          {/* Columna derecha, alineada al final (justify-self-end). */}
          <div className="col-start-3 flex items-center gap-1 justify-self-end">
            {/* Por debajo de xl la esquina de la página queda encima de la barra: ahí la lámpara vive en la barra. */}
            <BotonLampara className="xl:hidden" />
            {/* Sin fallback visible: mientras se lee la sesión, el espacio queda vacío un instante. */}
            <Suspense fallback={null}>
              <MenuUsuario />
            </Suspense>
            {/* En el celular, el menú lateral (Sheet) con las pestañas va al final, del lado del pulgar. */}
            <Suspense fallback={null}>
              <NavegacionPrincipal variante="movil" />
            </Suspense>
          </div>
        </div>
      </header>
      {/* DI-03 (prueba, Fase A): desde xl la barra ya no llega al borde de la ventana y la lámpara cuelga en la esquina
          superior derecha de la página, como un aplique en la pared. top-3.5: a la altura del centro de la barra. */}
      <BotonLampara flotante className="fixed top-3.5 right-4 z-40 hidden xl:inline-flex" />
      {/* pb-16: lo último de la página puede desplazarse por encima del botón flotante de tema (DI-03). */}
      <main className="flex-1 pb-16">{children}</main>
    </>
  );
}
