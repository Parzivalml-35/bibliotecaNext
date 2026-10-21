import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { MenuUsuario } from "@/components/menu-usuario";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Encabezado compartido: el layout envuelve a todas las páginas de app/. */}
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Biblioteca Next
            </Link>
            {/* Sin fallback visible: mientras se lee la sesión, el espacio queda vacío un instante. */}
            <Suspense fallback={null}>
              <MenuUsuario />
            </Suspense>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
