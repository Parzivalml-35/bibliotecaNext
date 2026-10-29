import { Badge } from "@/components/ui/badge";
import { plural } from "@/lib/formato";

// Etiqueta con las copias disponibles (success, DI-09), o gris si no hay ninguna. El texto lleva la información.
export function InsigniaDisponibilidad({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) return <Badge variant="secondary">Sin copias disponibles</Badge>;
  return <Badge variant="success">{plural(cantidad, "disponible", "disponibles")}</Badge>;
}
