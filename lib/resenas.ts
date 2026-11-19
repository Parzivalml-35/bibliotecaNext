// RN-94, RN-95: lo de las reseñas que comparten el navegador y el servidor (sin "server-only"): los motivos de reporte
// (los mismos del ENUM de reporte_resena.motivo) y cómo se escriben para una persona.

export const MOTIVOS_REPORTE = ["ofensiva", "spam", "revela_el_final", "otro"] as const;
export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number];

export const NOMBRE_MOTIVO: Record<MotivoReporte, string> = {
  ofensiva: "Es ofensiva",
  spam: "Es spam o publicidad",
  revela_el_final: "Revela el final",
  otro: "Otro motivo",
};

export function esMotivoReporte(valor: unknown): valor is MotivoReporte {
  return typeof valor === "string" && (MOTIVOS_REPORTE as readonly string[]).includes(valor);
}

export const MAX_DETALLE_REPORTE = 500; // el tamaño de reporte_resena.detalle (VARCHAR(500))
