import { plural } from "@/lib/formato";

// Píldora verde con las copias disponibles, o gris si no hay ninguna.
export function InsigniaDisponibilidad({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) {
    return (
      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Sin copias disponibles
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      {plural(cantidad, "disponible", "disponibles")}
    </span>
  );
}
