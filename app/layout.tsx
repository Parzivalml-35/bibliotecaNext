import type { Metadata } from "next";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { BotonTema } from "@/components/boton-tema";
import { MenuUsuario } from "@/components/menu-usuario";
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
      <body className="min-h-full flex flex-col">
        {/* Encabezado compartido: el layout envuelve a todas las páginas de app/. */}
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Biblioteca Next
            </Link>
            <div className="flex items-center gap-2">
              <BotonTema />
              {/* Sin fallback visible: mientras se lee la sesión, el espacio queda vacío un instante. */}
              <Suspense fallback={null}>
                <MenuUsuario />
              </Suspense>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
