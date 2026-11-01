"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// Páginas desde las que no tiene sentido "volver" después de entrar.
const SIN_VUELTA = ["/", "/login", "/registro", "/verificar"];

// DI-02 y RN-83: "Iniciar sesión" lleva la página actual en ?siguiente= para volver a ella al entrar.
// Client Component por usePathname (el layout no conoce la ruta). La ruta no se valida aquí: la validan
// la página de login y la acción con rutaInterna(), que es lo que protege; esto es solo el enlace.
export function EnlacesSinSesion() {
  const ruta = usePathname();
  const href = SIN_VUELTA.some((r) => ruta === r || ruta.startsWith(`${r}/`))
    ? "/login"
    : `/login?siguiente=${encodeURIComponent(ruta)}`;

  return (
    <div className="flex items-center gap-1">
      {/* asChild: Button pone su estilo en el <Link> hijo en vez de dibujar un <button> (Slot de Radix). */}
      <Button asChild variant="ghost">
        <Link href={href}>Iniciar sesión</Link>
      </Button>
      {/* hidden sm:inline-flex: en el celular solo cabe uno; "Crear cuenta" también está en el login. */}
      <Button asChild className="hidden sm:inline-flex">
        <Link href="/registro">Crear cuenta</Link>
      </Button>
    </div>
  );
}
