import { Suspense } from "react";
import { ListaLecturas } from "@/components/cuenta/lista-lecturas";

// "Mis lecturas" (RN-89, rediseño del 2026-11-12): un LAYOUT ANIDADO dentro del de Mi cuenta. Envuelve a
// /cuenta/lecturas (page.tsx) y a /cuenta/lecturas/[isbn] ([isbn]/page.tsx) con la lista de libros. Al pasar de un libro
// a otro con <Link>, Next vuelve a dibujar solo {children}: este layout (y la lista, con su scroll) se queda como está.
// En el Pages Router no hay layouts anidados: cada página se monta entera y la lista se volvería a cargar en cada clic.
//
// Como el layout de Mi cuenta y el del panel, NO protege la ruta (un layout no se vuelve a ejecutar al navegar entre sus
// páginas): cada página llama a exigirLector() (RN-35, RN-83). La lista lee la sesión, así que va en <Suspense>.
//
// data-ancho="amplio": el contenedor de Mi cuenta (max-w-3xl) se ensancha a max-w-6xl solo en esta sección, con CSS
// (has-[[data-ancho=amplio]] en app/(sitio)/cuenta/layout.tsx): lista y detalle no caben en 768 px.
// Grilla desde lg (1024 px): la lista en una columna de 18 rem y el detalle en el resto (minmax(0,1fr): sin el 0, un
// texto largo del detalle ensancharía la columna por encima del espacio disponible).
export default function LayoutLecturas({ children }: LayoutProps<"/cuenta/lecturas">) {
  return (
    <div data-ancho="amplio" className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0">{children}</div>
      {/* Fallback vacío: la lista aparece cuando llega; en el celular, debajo del título. */}
      <Suspense fallback={null}>
        <ListaLecturas />
      </Suspense>
    </div>
  );
}
