import type { Metadata } from "next";
import { FormularioContrasena, FormularioCorreo } from "@/components/formularios-seguridad";
import { exigirLector, obtenerUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Seguridad" };

// Pestaña "Seguridad" (DI-10): la contraseña (RN-78) y el correo (RN-79).
export default async function PaginaSeguridad() {
  await exigirLector("/cuenta/seguridad"); // RN-83. La zona "Mi cuenta" es de quien tiene perfil de lector
  // exigirLector ya garantizó la sesión; obtenerUsuario está en cache(): no vuelve a consultar la BD.
  const usuario = (await obtenerUsuario())!;

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Seguridad</h1>

      <section aria-labelledby="contrasena" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="contrasena" className="font-heading text-lg font-semibold">Contraseña</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Para cambiarla necesitas la actual.
        </p>
        <FormularioContrasena correo={usuario.correo} />
      </section>

      <section aria-labelledby="correo" className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 id="correo" className="font-heading text-lg font-semibold">Correo</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Tu correo es <span className="font-medium text-foreground break-words">{usuario.correo}</span>. Te enviaremos un enlace
          al correo nuevo; el cambio se hace cuando lo abras.
        </p>
        <FormularioCorreo />
      </section>
    </>
  );
}
