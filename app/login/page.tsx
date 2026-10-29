import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioLogin } from "@/components/formulario-login";
import { salir } from "@/lib/actions/sesion";
import { obtenerUsuario, rutaInterna } from "@/lib/sesion";

export const metadata: Metadata = { title: "Iniciar sesión" };

// Mensajes que exigirEmpleado() pide mostrar con ?motivo=. Se usa la clave para elegir un texto fijo:
// lo que venga en la URL nunca se pinta tal cual.
const MOTIVOS: Record<string, string> = {
  "sin-panel": "Esa cuenta no tiene acceso al panel de empleados.",
  "sin-cuenta-lector": "Esa cuenta no tiene perfil de lector.",
};

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { motivo, siguiente } = await searchParams;
  const usuario = await obtenerUsuario();
  // RN-83: a dónde volver al entrar. Se valida aquí para no poner en el formulario algo que no se va a usar,
  // y la acción lo vuelve a validar (es la que manda).
  const destino = rutaInterna(siguiente);
  if (usuario?.empleado) redirect("/panel"); // ya conectado como empleado: nada que hacer aquí

  const aviso = typeof motivo === "string" ? MOTIVOS[motivo] : undefined;

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
      {aviso && <p className="mt-3 text-sm text-warning-texto">{aviso}</p>}

      {usuario ? (
        // Conectado con una cuenta sin panel (un lector): ofrecer salir para entrar con otra.
        <div className="mt-6 space-y-4 text-sm">
          <p>Iniciaste sesión como <strong>{usuario.correo}</strong>.</p>
          <form action={salir}>
            <button type="submit" className="font-medium underline underline-offset-4">Cerrar sesión</button>
          </form>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <FormularioLogin siguiente={destino} />
          <p className="text-sm text-muted-foreground">
            ¿No tienes cuenta? <Link href="/registro" className="font-medium underline underline-offset-4">Regístrate</Link>
          </p>
        </div>
      )}
    </div>
  );
}
