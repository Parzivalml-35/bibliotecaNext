import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRestablecer } from "@/components/formularios-seguridad";

export const metadata: Metadata = { title: "Contraseña nueva" };

// RN-80, paso 2: el enlace del correo. Abrirlo NO cambia nada ni gasta el enlace (RN-32): la página solo muestra el
// formulario, y la acción comprueba el token cuando llega la contraseña nueva. No exige sesión.
export default async function PaginaRestablecer({ searchParams }: PageProps<"/restablecer">) {
  const { token } = await searchParams;
  const valor = typeof token === "string" ? token : "";

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Elige una contraseña nueva</h1>
      <div className="mt-6 space-y-4">
        {valor ? <FormularioRestablecer token={valor} /> : <p role="alert">El enlace no es válido.</p>}
        <p className="text-sm">
          <Link href="/login" className="font-medium underline underline-offset-4">Ir a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
