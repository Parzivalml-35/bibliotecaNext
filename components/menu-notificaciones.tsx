"use client";

import { CheckmarkCircle02Icon, Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { abrirEncuestaDigital, abrirNotificacion, marcarTodasLeidas } from "@/lib/actions/notificaciones";
import type { Notificacion } from "@/lib/data/notificaciones";
import { cn } from "@/lib/utils";

type Props = { notificaciones: Notificacion[]; noLeidas: number };

// RN-91: el menú de la campana. Client Component porque se abre y se cierra, y espera la respuesta de las acciones.
// Los datos llegan resueltos de CampanaNotificaciones (servidor); `import type` desde lib/data no trae código del
// servidor al navegador: los tipos se borran al compilar.
export function MenuNotificaciones({ notificaciones, noLeidas }: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Menú controlado: la campana vive en el layout, que NO se vuelve a montar al navegar. Si el menú se dejara solo, al
  // abrir un aviso (onSelect con preventDefault, para ver un posible error) seguiría abierto en la página nueva.
  const [abierto, setAbierto] = useState(false);

  // Abrir: la acción marca leída y devuelve la ruta (validada en el servidor); el navegador va ahí. El número baja
  // solo, porque la acción llama a refresh() y el layout vuelve a dibujar la campana con los datos nuevos.
  // Una guardada se abre por su id; una encuesta calculada (RN-93), por el préstamo digital que venció.
  function abrir(n: Notificacion) {
    setError(null);
    iniciar(async () => {
      const r = n.id_notificacion !== null ? await abrirNotificacion(n.id_notificacion) : await abrirEncuestaDigital(n.id_prestamo_digital);
      if (!r.ok) return setError(r.error);
      setAbierto(false);
      router.push(r.valor);
    });
  }

  function leerTodas() {
    setError(null);
    iniciar(async () => {
      const r = await marcarTodasLeidas();
      if (!r.ok) setError(r.error);
    });
  }

  // El nombre del botón dice cuántas hay sin leer: el número del círculo es aria-hidden (un lector de pantalla leería
  // "3" sin contexto). "9+" para que el círculo no crezca.
  const etiqueta = noLeidas === 0 ? "Notificaciones" : `Notificaciones, ${noLeidas} sin leer`;

  return (
    <DropdownMenu
      open={abierto}
      onOpenChange={(a) => {
        setAbierto(a);
        if (!a) setError(null); // al cerrar, el error de la vez anterior no reaparece
      }}
    >
      <DropdownMenuTrigger asChild>
        {/* relative: el círculo del número se posiciona respecto al botón. */}
        <Button type="button" variant="ghost" size="icon" className="relative rounded-full">
          <HugeiconsIcon icon={Notification01Icon} aria-hidden="true" />
          <span className="sr-only">{etiqueta}</span>
          {noLeidas > 0 && (
            // absolute top-1 right-1: el círculo en la esquina superior derecha del ícono. min-w-4 h-4 + px-1: un
            // círculo con un dígito y una píldora con "9+". bg-primary/text-primary-foreground: el acento del tema
            // (contraste medido en la Fase R). tabular-nums: los dígitos miden lo mismo.
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
            >
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      {/* w-80: ancho fijo para que los textos se lean en dos líneas; max-w-[calc(100vw-2rem)]: en un celular angosto no
          se sale de la pantalla. collisionPadding: Radix lo corre si chocaría con el borde, pero sin margen lo deja pegado
          a él; 16 px es el margen lateral de la página. */}
      <DropdownMenuContent align="end" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">Notificaciones</span>
          {noLeidas > 0 && (
            // Un botón dentro del encabezado y no un ítem: no es un destino. onClick no cierra el menú.
            <Button type="button" variant="ghost" size="xs" disabled={pendiente} onClick={leerTodas}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} aria-hidden="true" />
              Marcar todas como leídas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notificaciones.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tienes avisos.</p>
        ) : (
          notificaciones.map((n) => (
            // onSelect: Radix lo llama con Enter, espacio o clic. preventDefault: el menú queda abierto mientras corre
            // la acción (si se cerrara, un error no se vería); se cierra al navegar.
            <DropdownMenuItem
              key={n.id_notificacion ?? `p${n.id_prestamo_digital}`}
              disabled={pendiente}
              onSelect={(e) => {
                e.preventDefault();
                abrir(n);
              }}
              className="items-start"
            >
              {/* El punto marca las no leídas; el texto sr-only lo dice con palabras (el color no es la única señal). */}
              <span
                aria-hidden="true"
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.leida ? "bg-transparent" : "bg-primary")}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !n.leida && "font-medium")}>
                  {!n.leida && <span className="sr-only">Sin leer: </span>}
                  {n.texto}
                </span>
                <span className="block text-xs text-muted-foreground">{n.fecha}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        {error && (
          <p role="alert" className="px-3 py-2 text-xs text-danger-texto">
            {error}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
