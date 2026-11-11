import type { ReactNode } from "react";
import { VisorEpub } from "@/components/visor-epub";
import { VisorPdf } from "@/components/visor-pdf";
import type { FormatoDigital } from "@/lib/definitions";

// Lo que el visor muestra del libro, ya resuelto en el servidor (la página lo arma con la BD).
// acceso: "Préstamo digital hasta el …" o "Comprado: acceso permanente". otroFormato: el enlace para cambiar de formato.
export type FichaLibro = {
  isbn: string;
  titulo: string;
  autores: string;
  acceso: string;
  otroFormato: { href: string; nombre: string } | null;
};

// DI-06, límite 1: las páginas usan <Visor formato=…> y no saben qué librería hay dentro (pdf.js, foliate-js).
// Cambiar de motor (por ejemplo, a Readium) toca solo este archivo y el visor de ese formato.
// Sin "use client": solo elige. Los dos visores sí son Client Components, y se pueden usar desde aquí igual que desde
// una página del servidor. `portada` y `detalles` son nodos ya dibujados en el servidor (<Portada>, la lista de datos
// del catálogo): un Client Component puede recibir JSX de un Server Component como prop y mostrarlo sin volverlo cliente.
export function Visor({ formato, url, ficha, portada, detalles }: {
  formato: FormatoDigital;
  url: string;
  ficha: FichaLibro;
  portada: ReactNode;
  detalles: ReactNode;
}) {
  return formato === "epub"
    ? <VisorEpub url={url} ficha={ficha} portada={portada} detalles={detalles} />
    : <VisorPdf url={url} titulo={ficha.titulo} />;
}
