import { colorDePortada } from "@/lib/portada";
import { cn } from "@/lib/utils";

// DI-05: portada generada (título, autor y color del ISBN) mientras no haya imagen real. Server Component.
// aria-hidden: es una ilustración. Donde aparece, el título y el autor ya están escritos al lado; leerlos dos veces
// sería ruido para el lector de pantalla. El ancho lo pone quien la usa (className); la altura sale de la proporción.
export function Portada({ isbn, titulo, autores, className }: {
  isbn: string;
  titulo: string;
  autores: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      // El color se calcula por libro: va en style, no en una clase (Tailwind solo genera las clases que lee en el código).
      style={{ backgroundColor: colorDePortada(isbn) }}
      // @container: los hijos miden en cqw (1 % del ancho de ESTA caja), así todo escala con la portada.
      className={cn("@container relative aspect-2/3 overflow-hidden rounded-md text-white", className)}
    >
      {/* El lomo: una franja más oscura a la izquierda, donde no hay texto (no afecta el contraste medido).
          w-[6%] sí es del ancho de la portada: un absolute mide su porcentaje contra la caja relative que lo contiene. */}
      <div className="absolute inset-y-0 left-0 w-[6%] bg-black/25" />
      {/* R6: el relleno va en cqw y en un div interno. Un padding en % se calcula sobre el ancho del PADRE de la
          portada (en la ficha, ~1000 px), no sobre la portada; y la propia caja @container no puede usar sus cqw
          (las unidades cqw se resuelven contra un contenedor ancestro). */}
      <div className="flex h-full flex-col justify-between p-[8cqw] pl-[12cqw]">
        <p className="line-clamp-5 font-heading text-[11cqw] leading-tight font-semibold">{titulo}</p>
        <div>
          <div className="mb-[6cqw] h-px bg-white/40" />
          <p className="line-clamp-2 text-[7.5cqw] leading-snug text-white/85">{autores}</p>
        </div>
      </div>
    </div>
  );
}
