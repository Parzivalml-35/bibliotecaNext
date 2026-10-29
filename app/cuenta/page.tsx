import type { Metadata } from "next";
import { EstadoLector } from "@/components/resumen-lector";
import { obtenerResumenLector } from "@/lib/data/lectores";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi cuenta" };

// Pestaña "Resumen" (DI-10): quién es y si puede pedir libros. Préstamos, digitales y multas tienen su pestaña.
export default async function PaginaCuenta() {
  // El lector sale de la sesión, nunca de la URL: /cuenta no recibe ningún id.
  const lector = await exigirLector("/cuenta"); // RN-83: volver aquí después del login
  const resumen = await obtenerResumenLector(lector.idLector);
  if (!resumen) return null; // la cuenta se desactivó entre la sesión y la consulta

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">{resumen.nombre} · {resumen.correo}</p>
      <EstadoLector resumen={resumen} />
    </>
  );
}
