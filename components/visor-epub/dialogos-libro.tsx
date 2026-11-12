"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { FichaLibro } from "@/components/visor";

// Los dos diálogos de la ficha del visor (idea de Readest; código nuestro). Usan el Dialog de shadcn (Radix): abre con
// clic, Enter o Espacio; se cierra con Esc, con el botón o al hacer clic fuera; mientras está abierto, el foco no sale
// del diálogo y, al cerrarlo, vuelve al botón que lo abrió. `portada` y `detalles` llegan ya dibujados del servidor.

// La portada de la ficha es un botón: al hacer clic se ve en grande.
export function PortadaAmpliable({ ficha, portada }: { ficha: FichaLibro; portada: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* w-12: el ancho de la miniatura (la altura sale de la proporción 2:3 de <Portada>). */}
        <button type="button" className="w-12 shrink-0 rounded-md transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          {portada}
          <span className="sr-only">Ver la portada de {ficha.titulo} en grande</span>
        </button>
      </DialogTrigger>
      {/* sm:max-w-xs: un diálogo angosto, del tamaño de la portada. pt-14: espacio arriba para el botón ✕ (va con
          absolute en la esquina), así no tapa la portada. */}
      <DialogContent className="pt-14 sm:max-w-xs">
        {/* Radix exige un título (lo anuncia el lector de pantalla); aquí no hace falta verlo. */}
        <DialogTitle className="sr-only">Portada de {ficha.titulo}</DialogTitle>
        <DialogDescription className="sr-only">Portada generada a partir del título y el autor.</DialogDescription>
        <div className="mx-auto w-56">{portada}</div>
      </DialogContent>
    </Dialog>
  );
}

// El botón (i): "Detalles del libro" con los datos de la BD.
export function BotonDetalles({ ficha, portada, detalles }: { ficha: FichaLibro; portada: ReactNode; detalles: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="shrink-0">
          <HugeiconsIcon icon={InformationCircleIcon} aria-hidden="true" />
          <span className="sr-only">Detalles del libro</span>
        </Button>
      </DialogTrigger>
      {/* max-h-[85dvh] + overflow-y-auto: con una sinopsis larga, el diálogo se desplaza por dentro en vez de salirse
          de la pantalla. */}
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalles del libro</DialogTitle>
          <DialogDescription className="sr-only">Datos del catálogo de la biblioteca para {ficha.titulo}.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="w-20 shrink-0">{portada}</div>
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold">{ficha.titulo}</p>
            <p className="text-muted-foreground">{ficha.autores}</p>
            <p className="mt-2 text-xs text-muted-foreground">{ficha.acceso}</p>
          </div>
        </div>
        {detalles}
      </DialogContent>
    </Dialog>
  );
}
