type InsigniaSeccionProps = {
  seccion: string;
  color: string; // color_hex de la sección (viene de la BD → va en style, no en una clase)
  detalle?: string; // opcional, ej. el género: "Literatura · Novela"
};

// Punto con el color de la sección + su nombre. El color nunca va solo: el texto lleva la información
// y el punto es decorativo (aria-hidden), así funciona también para personas con daltonismo.
export function InsigniaSeccion({ seccion, color, detalle }: InsigniaSeccionProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {seccion}
      {detalle && ` · ${detalle}`}
    </span>
  );
}
