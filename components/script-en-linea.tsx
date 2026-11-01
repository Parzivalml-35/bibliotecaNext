"use client";

// Patrón de la guía "Preventing flash before hydration" de Next 16 (InlineScript).
// En el servidor el script sale como text/javascript y el navegador lo ejecuta al leer el HTML. En el cliente,
// React lo dibuja como text/plain: así no avisa de "Encountered a script tag" (un <script> creado por React no se
// ejecuta) y suppressHydrationWarning acepta la diferencia de type entre los dos.
// Es Client Component a propósito: si fuera de servidor, typeof window siempre sería "undefined".
export function ScriptEnLinea({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
