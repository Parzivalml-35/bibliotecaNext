"use client";

import { useSearchParams } from "next/navigation";

// Mensajes que exigirEmpleado() pide mostrar con ?motivo= al devolver a alguien a su inicio. Se usa la clave para
// elegir un texto fijo: lo que venga en la URL nunca se pinta tal cual.
const MOTIVOS: Record<string, string> = {
  "sin-permiso": "Tu rol no permite abrir esa página.",
};

// Vive en el layout del panel porque el inicio cambia según el rol: así sirve para cualquier página de destino.
// Es Client Component porque un layout no recibe searchParams; useSearchParams sí los conoce. El layout lo envuelve
// en <Suspense>, como pide la guía de useSearchParams.
export function AvisoPanel() {
  const motivo = useSearchParams().get("motivo");
  const aviso = motivo ? MOTIVOS[motivo] : undefined;
  if (!aviso) return null;
  return <p role="alert" className="-mt-4 mb-6 text-sm text-warning-texto">{aviso}</p>;
}
