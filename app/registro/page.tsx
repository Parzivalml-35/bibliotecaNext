import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioRegistro } from "@/components/formularios-lector";
import { listarCiudades } from "@/lib/data/lectores";
import { obtenerUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function PaginaRegistro({ searchParams }: PageProps<"/registro">) {
  if (await obtenerUsuario()) redirect("/cuenta"); // ya conectado
  const { enviado } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Crear cuenta de lector</h1>
      {enviado === "1" ? (
        // Mismo mensaje exista o no el correo (ver registrarLector): no se revela quién tiene cuenta.
        <div role="status" className="mt-6 space-y-3 text-sm">
          <p>Si el correo es válido, te enviamos un enlace para verificarlo. Ábrelo para activar tu cuenta.</p>
          <p className="text-muted-foreground">En este entorno de desarrollo el correo no se envía: el enlace aparece en la consola del servidor.</p>
          <p><Link href="/login" className="font-medium underline underline-offset-4">Ir a iniciar sesión</Link></p>
        </div>
      ) : (
        <>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Con la cuenta verificada puedes reservar y leer libros digitales. Para llevarte libros físicos, presenta tu documento en cualquier sede.
          </p>
          <FormularioRegistro ciudades={await listarCiudades()} />
        </>
      )}
    </div>
  );
}
