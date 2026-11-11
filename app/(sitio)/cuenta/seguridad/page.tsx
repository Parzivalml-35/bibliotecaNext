import type { Metadata } from "next";
import { SeccionContrasena, SeccionCorreo } from "@/components/secciones-cuenta";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Seguridad" };

// Pestaña "Seguridad" (DI-10): la contraseña (RN-78) y el correo (RN-79). Las secciones son de la cuenta y las comparte
// /panel/perfil (components/secciones-cuenta.tsx).
export default async function PaginaSeguridad() {
  await exigirLector("/cuenta/seguridad"); // RN-83. La zona "Mi cuenta" es de quien tiene perfil de lector

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Seguridad</h1>
      <div className="space-y-6">
        <SeccionContrasena />
        <SeccionCorreo />
      </div>
    </>
  );
}
