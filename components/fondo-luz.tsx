// DI-14: la pared y su luz, detrás de toda la página. Server Component sin estado: solo marcado; el CSS de
// app/globals.css ("Luz sobre la pared") dibuja cada capa y muestra la del tema activo con un fundido (DI-15).
// fixed inset-0: cubre la ventana y no se mueve al desplazarse (la luz está en la pared, no en el contenido).
// -z-10 + pointer-events-none: queda detrás de todo y no intercepta clics. aria-hidden: es decoración.
export function FondoLuz() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="pared-textura" />
      <div className="luz luz-sol" />
      <div className="luz luz-luna" />
      <div className="luz luz-lampara" />
    </div>
  );
}
