import { Badge } from "@/components/ui/badge";
import { plural } from "@/lib/formato";

// El estado de un préstamo físico abierto, el mismo para el lector (Mi cuenta) y el empleado (mostrador).
// Los datos los calcula el SQL (lib/data): aquí solo se elige el color y el texto (DI-09). El orden importa:
// un perdido no cuenta como vencido (RN-71) y "por vencer" es solo un aviso, nunca un bloqueo (RN-76).
export function EtiquetaPrestamo({ prestamo }: {
  prestamo: { dias_atraso: number; dias_restantes: number; por_vencer: number; perdido?: number };
}) {
  if (prestamo.perdido) return <Badge variant="secondary">Declarado perdido</Badge>;
  if (prestamo.dias_atraso > 0) return <Badge variant="danger">Vencido · {plural(prestamo.dias_atraso, "día", "días")}</Badge>;
  if (prestamo.por_vencer) {
    return (
      <Badge variant="warning">
        {prestamo.dias_restantes === 0 ? "Vence hoy" : `Vence en ${plural(prestamo.dias_restantes, "día", "días")}`}
      </Badge>
    );
  }
  return <Badge variant="success">Al día</Badge>;
}
