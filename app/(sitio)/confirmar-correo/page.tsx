import type { Metadata } from "next";
import { FormularioConfirmarCorreo } from "@/components/formularios-seguridad";

export const metadata: Metadata = { title: "Confirmar correo" };

// RN-79: el enlace que llega al correo nuevo. Como /verificar (RN-32), abrirlo NO cambia nada: una vista previa del
// cliente de correo o un antivirus que visite el enlace no debe gastarlo. El cambio lo hace el POST del botón.
// No exige sesión: el token es la prueba, y el enlace puede abrirse en el celular aunque la sesión esté en el PC.
export default async function PaginaConfirmarCorreo({ searchParams }: PageProps<"/confirmar-correo">) {
  const { token } = await searchParams;
  const valor = typeof token === "string" ? token : "";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Confirmar el nuevo correo</h1>
      <div className="mt-6">
        {valor ? <FormularioConfirmarCorreo token={valor} /> : <p role="alert">El enlace no es válido.</p>}
      </div>
    </div>
  );
}
