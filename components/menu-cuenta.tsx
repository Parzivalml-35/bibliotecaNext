"use client";

import { DashboardSquare01Icon, Logout03Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { salir } from "@/lib/actions/sesion";

// "Ana María Ruiz" → "AR"; "ana.ruiz@example.com" → "A". DI-12: las iniciales son el respaldo del avatar;
// la imagen de DiceBear o la foto propia llegan en R7 (AvatarImage), y si no cargan se vuelve a esto.
function iniciales(nombre: string): string {
  const partes = nombre.split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0]?.[0] ?? "?");
  return letras.toUpperCase();
}

type Props = { nombre: string; correo: string; esLector: boolean; esEmpleado: boolean };

// DI-02 y DI-12: el avatar abre el menú de la cuenta. Client Component porque el menú se abre y se cierra
// (estado); los datos llegan ya resueltos de MenuUsuario, en el servidor.
export function MenuCuenta({ nombre, correo, esLector, esEmpleado }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="rounded-full">
          <Avatar>
            <AvatarFallback className="font-medium">{iniciales(nombre)}</AvatarFallback>
          </Avatar>
          <span className="sr-only">Menú de la cuenta de {nombre}</span>
        </Button>
      </DropdownMenuTrigger>
      {/* align="end": el borde derecho del menú coincide con el del avatar, para que no se salga de la pantalla. */}
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{nombre}</span>
          <span className="block truncate">{correo}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* asChild: el ítem del menú es el propio <Link>, así se navega con el teclado (Enter) y con el clic. */}
        {esLector && (
          <DropdownMenuItem asChild>
            <Link href="/cuenta">
              <HugeiconsIcon icon={UserIcon} aria-hidden="true" />
              Mi cuenta
            </Link>
          </DropdownMenuItem>
        )}
        {esEmpleado && (
          <DropdownMenuItem asChild>
            <Link href="/panel">
              <HugeiconsIcon icon={DashboardSquare01Icon} aria-hidden="true" />
              Panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {/* Salir sigue siendo un POST (ver lib/actions/sesion.ts). El menú vive en un portal, fuera del header,
            pero el <form> va dentro del menú, así que el botón sigue dentro de su formulario.
            preventDefault en onSelect: por defecto el menú se cierra y desmonta el botón en el mismo clic, y el
            navegador cancela el envío de un formulario que ya no está en la página. Así queda abierto hasta
            que la acción redirige. */}
        <form action={salir}>
          <DropdownMenuItem asChild variant="destructive" onSelect={(e) => e.preventDefault()}>
            <button type="submit" className="w-full">
              <HugeiconsIcon icon={Logout03Icon} aria-hidden="true" />
              Salir
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
