import type { Metadata } from "next";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import { BotonTema } from "@/components/boton-tema";
import { ScriptEnLinea } from "@/components/script-en-linea";
import { scriptTema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import "./globals.css";

// docs/diseno.md, "Tipografía": Figtree para el texto (preset Maia de shadcn), Fraunces para los títulos
// y Geist Mono para los códigos de barras.
const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Las páginas hijas ponen su propio título y la plantilla le agrega el sufijo: "Rayuela | Biblioteca Next".
  title: { default: "Biblioteca Next", template: "%s | Biblioteca Next" },
  description: "Catálogo de la red de bibliotecas: disponibilidad por sede y ubicación de cada libro.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={cn("h-full antialiased font-sans", figtree.variable, fraunces.variable, geistMono.variable)}
      // El script del <head> agrega data-tema antes de que React hidrate: sin esto, React avisaría de que el
      // <html> del navegador no coincide con el del servidor. Solo afecta a los atributos de este elemento.
      suppressHydrationWarning
    >
      <head>
        {/* DI-04: el tema se aplica antes del primer pintado (ver lib/tema.ts). */}
        <ScriptEnLinea html={scriptTema} />
      </head>
      {/* R5d: el layout raíz solo pone lo común a TODAS las páginas (documento, fuentes, tema). La barra superior
          vive en app/(sitio)/layout.tsx, para que el visor (app/leer) pueda quedar fuera de ella (DI-10, "visor
          inmersivo"). flex-col + min-h-full: los layouts hijos pueden estirar su <main> hasta el pie. */}
      <body className="min-h-full flex flex-col">
        {children}
        {/* DI-03: el botón flotante de claro y oscuro, en todas las páginas (también el visor). */}
        <BotonTema />
      </body>
    </html>
  );
}
