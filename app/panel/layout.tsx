import { Suspense } from "react";
import { AvisoPanel } from "@/components/panel/aviso-panel";
import { MenuPanel } from "@/components/panel/menu-panel";

// Navegación del panel. Este layout NO verifica la sesión, a propósito: un layout no se vuelve a ejecutar
// al navegar entre sus páginas (renderizado parcial) y no impide que sus páginas se rendericen. La
// verificación va en cada página y en cada Server Action (exigirEmpleado, RN-35). Aquí solo se MUESTRA el menú
// del rol (DI-11): leer la sesión para eso está bien, decidir con ella quién entra, no.
export default function LayoutPanel({ children }: LayoutProps<"/panel">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Fallback del mismo alto que el menú, para que el contenido no salte cuando aparece. */}
      <Suspense fallback={<div className="mb-8 h-[49px] border-b border-zinc-200 dark:border-zinc-800" />}>
        <MenuPanel />
      </Suspense>
      <Suspense fallback={null}>
        <AvisoPanel />
      </Suspense>
      {children}
    </div>
  );
}
