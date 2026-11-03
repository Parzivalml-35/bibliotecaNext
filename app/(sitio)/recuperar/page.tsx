import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperar } from "@/components/formularios-seguridad";

export const metadata: Metadata = { title: "Recuperar contraseña" };

// RN-80, paso 1. Como /registro: después de enviar, la acción redirige a ?enviado=1 y TODOS ven el mismo aviso,
// exista o no la cuenta. No redirige a quien tenga sesión: puede querer recuperar la contraseña de otra cuenta.
export default async function PaginaRecuperar({ searchParams }: PageProps<"/recuperar">) {
  const { enviado } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
      {enviado === "1" ? (
        <div role="status" className="mt-6 space-y-3 text-sm">
          <p>Si ese correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Vence en poco tiempo: ábrelo pronto.</p>
          <p className="text-muted-foreground">En este entorno de desarrollo el correo no se envía: el enlace aparece en la consola del servidor.</p>
          <p><Link href="/login" className="font-medium underline underline-offset-4">Volver a iniciar sesión</Link></p>
        </div>
      ) : (
        <>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Escribe el correo de tu cuenta y te enviaremos un enlace.</p>
          <FormularioRecuperar />
        </>
      )}
    </div>
  );
}
