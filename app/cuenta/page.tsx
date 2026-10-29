import type { Metadata } from "next";
import Link from "next/link";
import { EstadoLector } from "@/components/resumen-lector";
import { obtenerPrestamosDeLector, obtenerResumenLector } from "@/lib/data/lectores";
import { plural } from "@/lib/formato";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi cuenta" };

// Pestaña "Resumen" (DI-10): quién es, si puede pedir libros y lo que vence pronto (RN-76).
// Préstamos, digitales y multas tienen su pestaña.
export default async function PaginaCuenta() {
  // El lector sale de la sesión, nunca de la URL: /cuenta no recibe ningún id.
  const lector = await exigirLector("/cuenta"); // RN-83: volver aquí después del login
  const [resumen, prestamos] = await Promise.all([
    obtenerResumenLector(lector.idLector),
    obtenerPrestamosDeLector(lector.idLector),
  ]);
  if (!resumen) return null; // la cuenta se desactivó entre la sesión y la consulta

  // RN-76: solo un aviso. Un perdido no se avisa (RN-71) y un vencido ya aparece como bloqueo (RN-03).
  const porVencer = prestamos.filter((p) => p.por_vencer && !p.perdido).length;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{resumen.nombre} · {resumen.correo}</p>
      <EstadoLector resumen={resumen} />

      {porVencer > 0 && (
        // DI-09: warning con texto (el color nunca va solo). role="status": se anuncia sin interrumpir.
        <p role="status" className="mt-4 rounded-2xl border border-warning/40 bg-warning-suave px-4 py-3 text-sm text-warning-texto">
          {porVencer === 1 ? "Tienes 1 préstamo por vencer." : `Tienes ${plural(porVencer, "préstamo", "préstamos")} por vencer.`}{" "}
          <Link href="/cuenta/prestamos" className="font-medium underline underline-offset-4">Ver mis préstamos</Link>
        </p>
      )}
    </>
  );
}
