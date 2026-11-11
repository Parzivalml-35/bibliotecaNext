import { VisorEpub } from "@/components/visor-epub";
import { VisorPdf } from "@/components/visor-pdf";
import type { FormatoDigital } from "@/lib/definitions";

// DI-06, límite 1: las páginas usan <Visor formato=…> y no saben qué librería hay dentro (pdf.js, foliate-js).
// Cambiar de motor (por ejemplo, a Readium) toca solo este archivo y el visor de ese formato.
// Sin "use client": solo elige. Los dos visores sí son Client Components, y se pueden usar desde aquí igual que desde
// una página del servidor.
export function Visor({ formato, url, titulo }: { formato: FormatoDigital; url: string; titulo: string }) {
  return formato === "epub" ? <VisorEpub url={url} titulo={titulo} /> : <VisorPdf url={url} titulo={titulo} />;
}
