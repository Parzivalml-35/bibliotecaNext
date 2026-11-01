import type { Metadata } from "next";
import { FormularioVerificar } from "@/components/formularios-lector";

export const metadata: Metadata = { title: "Verificar correo" };

// Abrir el enlace NO verifica nada: esta página solo muestra un botón. Si el GET consumiera el token, una
// vista previa del enlace en el cliente de correo (o un antivirus que lo visita) lo gastaría antes que la
// persona. Verificar es un cambio de estado, y los cambios de estado van por POST (RN-32).
export default async function PaginaVerificar({ searchParams }: PageProps<"/verificar">) {
  const { token } = await searchParams;
  const valor = typeof token === "string" ? token : "";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Verificar correo</h1>
      <div className="mt-6">
        {valor ? <FormularioVerificar token={valor} /> : <p role="alert">El enlace no es válido.</p>}
      </div>
    </div>
  );
}
