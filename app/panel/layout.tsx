import Link from "next/link";

// Navegación del panel. Este layout NO verifica la sesión, a propósito: un layout no se vuelve a ejecutar
// al navegar entre sus páginas (renderizado parcial) y no impide que sus páginas se rendericen. La
// verificación va en cada página y en cada Server Action (exigirEmpleado, RN-35).
export default function LayoutPanel({ children }: LayoutProps<"/panel">) {
  const enlace = "rounded-md px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800";
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Panel de empleado" className="mb-8 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link href="/panel" className={enlace}>Préstamos abiertos</Link>
        <Link href="/panel/prestamos" className={enlace}>Nuevo préstamo</Link>
        <Link href="/panel/devoluciones" className={enlace}>Devolución</Link>
      </nav>
      {children}
    </div>
  );
}
