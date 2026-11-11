"use client";

import Image from "next/image";
import { type ChangeEvent, type FormEvent, useActionState, useEffect, useState } from "react";
import { AjusteFoto } from "@/components/ajuste-foto";
import { buttonVariants } from "@/components/ui/button";
import { claseBoton, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { elegirEstiloAvatar, generarOtroAvatar, quitarFotoAvatar, subirFotoAvatar } from "@/lib/actions/avatar";
import type { EstadoFormulario } from "@/lib/definitions";
import { cn } from "@/lib/utils";

const estadoInicial: EstadoFormulario = {};

// Una opción del selector, ya resuelta en el servidor: lib/avatar.ts usa node:crypto y no puede venir al navegador.
export type OpcionAvatar = { estilo: string; nombre: string; url: string };

// actual: el avatar generado con el estilo de la cuenta. foto: URL de la foto (RN-82) o null si usa el generado.
// maxKb: configuracion.max_kb_avatar, para el texto de ayuda y la revisión previa en el navegador.
type Props = { actual: OpcionAvatar; opciones: OpcionAvatar[]; foto: string | null; maxKb: number };

const claseBotonSecundario = cn(buttonVariants({ variant: "outline", size: "lg" }), "disabled:cursor-wait");

// RN-81 y RN-82: avatar de la CUENTA (sirve a un lector y, en R7i, a un empleado). Cuatro formularios, cada uno con su
// acción: "Generar otro" o "Volver al avatar generado" junto a la imagen, subir una foto y elegir el estilo.
// Client Component por useActionState y la revisión del tamaño. Funciona sin JavaScript: las imágenes son <img>
// normales, el selector son radios de HTML y la foto un <input type="file"> en un formulario multipart.
export function FormularioAvatar({ actual, opciones, foto, maxKb }: Props) {
  const [estadoSemilla, accionSemilla, generando] = useActionState(generarOtroAvatar, estadoInicial);
  const [estadoEstilo, accionEstilo, guardando] = useActionState(elegirEstiloAvatar, estadoInicial);
  const [estadoFoto, accionFoto, subiendo] = useActionState(subirFotoAvatar, estadoInicial);
  const [estadoQuitar, accionQuitar, quitando] = useActionState(quitarFotoAvatar, estadoInicial);
  // Mensaje de la revisión hecha en el navegador (no pasó por el servidor, así que no está en estadoFoto).
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  // El último formulario de la imagen que se usó: la fila muestra "Generar otro" O "Volver al avatar generado" según
  // haya foto, así que al volver el botón cambia y su mensaje no puede depender de qué botón se ve ahora (se perdería,
  // como anota docs/estado.md). Y el "Listo" de una foto ya quitada no debe quedarse junto al de volver.
  // Sin JavaScript onSubmit no corre (ultimo = null), pero cada envío dibuja la página de nuevo y solo un estado trae mensaje.
  const [ultimo, setUltimo] = useState<"semilla" | "quitar" | "foto" | null>(null);
  const conMensaje = (estado: EstadoFormulario) => Boolean(estado.error || estado.exito);
  const estadoFila = ultimo === "quitar" || (ultimo === null && conMensaje(estadoQuitar)) ? estadoQuitar : estadoSemilla;

  // RN-82: la foto elegida, para la vista previa (AjusteFoto). `estado` es el estadoFoto que había al elegirla: cuando la
  // acción responde, useActionState trae un objeto NUEVO y la vista previa deja de mostrarse (React además vacía el
  // campo de archivo al terminar la acción). Así no queda una vista previa de una foto que ya se subió.
  const [previa, setPrevia] = useState<{ url: string; estado: EstadoFormulario } | null>(null);
  const urlPrevia = previa?.url;
  // URL.createObjectURL reserva memoria hasta que se libera: al cambiar de foto o salir de la página, se libera la anterior.
  // La función que devuelve el efecto es la "limpieza": React la llama antes del siguiente efecto y al desmontar.
  useEffect(() => {
    if (!urlPrevia) return;
    return () => URL.revokeObjectURL(urlPrevia);
  }, [urlPrevia]);

  // El mensaje del formulario de la foto: el error del navegador si lo hay; si hay una vista previa pendiente, ninguno
  // (el "Listo" de la subida anterior no corresponde a la foto nueva que se está ajustando); si no, el de la acción.
  const previaVisible = previa !== null && previa.estado === estadoFoto;
  const estadoFotoVisible: EstadoFormulario = errorLocal
    ? { error: errorLocal }
    : previaVisible || (ultimo !== "foto" && ultimo !== null) ? {} : estadoFoto;

  const limite = maxKb >= 1024 ? `${(maxKb / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB` : `${maxKb} KB`;

  // Solo una comodidad: el servidor vuelve a comprobarlo todo (procesarFoto). Hace falta porque un archivo de más de
  // 3 MB (bodySizeLimit en next.config.ts) lo corta Next antes de llegar a la acción, y el usuario vería la página de
  // error en vez de un mensaje. preventDefault() en onSubmit hace que React NO ejecute la acción del formulario.
  function revisarTamano(evento: FormEvent<HTMLFormElement>) {
    setUltimo("foto");
    const archivo = new FormData(evento.currentTarget).get("foto");
    if (archivo instanceof File && archivo.size > maxKb * 1024) {
      evento.preventDefault();
      setErrorLocal(`La foto pesa más de ${limite}. Elige una más liviana.`);
    } else {
      setErrorLocal(null);
    }
  }

  // Al elegir un archivo: si pesa de más, el aviso de una vez (sin vista previa); si no, la vista previa local.
  function elegirArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.currentTarget.files?.[0];
    setUltimo("foto");
    setErrorLocal(null);
    if (!archivo) return setPrevia(null);
    if (archivo.size > maxKb * 1024) {
      setPrevia(null);
      return setErrorLocal(`La foto pesa más de ${limite}. Elige una más liviana.`);
    }
    setPrevia({ url: URL.createObjectURL(archivo), estado: estadoFoto });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* next/image con unoptimized: no pasa por el optimizador de Next (un SVG no se optimiza, y la foto ya llega en
            WebP de 256 px desde una ruta que exige la cookie de sesión) y sale como un <img> normal. width/height
            reservan el espacio: la página no salta al cargar. */}
        <Image src={foto ?? actual.url} alt="Tu avatar actual" width={96} height={96} unoptimized
               className="size-24 rounded-full border border-border bg-muted object-cover" />
        {foto ? (
          // Con foto, la acción de esta fila es volver al generado (RN-81: "volver al generado cuando quiera").
          <form action={accionQuitar} onSubmit={() => setUltimo("quitar")}>
            <button type="submit" disabled={quitando} className={claseBotonSecundario}>
              {quitando ? "Cambiando…" : "Volver al avatar generado"}
            </button>
          </form>
        ) : (
          <form action={accionSemilla} onSubmit={() => setUltimo("semilla")}>
            <button type="submit" disabled={generando} className={claseBotonSecundario}>
              {generando ? "Generando…" : "Generar otro"}
            </button>
          </form>
        )}
      </div>
      <MensajeFormulario estado={estadoFila} />

      {/* La foto (RN-82). Con una función como action, React pone method="post" y encType="multipart/form-data" él
          solo: sin multipart, el navegador enviaría solo el NOMBRE del archivo. */}
      <form action={accionFoto} onSubmit={revisarTamano} className="space-y-3">
        <div>
          <label htmlFor="foto" className={claseEtiqueta}>{foto ? "Cambiar tu foto" : "Usar una foto"}</label>
          <p id="ayuda-foto" className="mt-1 text-sm text-muted-foreground">
            JPEG, PNG o WebP de hasta {limite}. La recortamos cuadrada y le quitamos los datos ocultos, como la ubicación.
            Solo la ven tú y el personal de la biblioteca.
          </p>
          {/* accept solo filtra lo que ofrece el selector de archivos: el servidor comprueba el tipo por el contenido.
              file:* (Tailwind) da estilo al botón interno del campo (el pseudo-elemento ::file-selector-button). */}
          <input id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" required
                 aria-describedby="ayuda-foto" onChange={elegirArchivo}
                 className="mt-2 block w-full max-w-md text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-4xl file:border file:border-borde-campo file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
        </div>
        {/* key={url}: otra foto = otro AjusteFoto, con el zoom y la posición desde cero. Si el navegador no puede
            mostrarla (archivo dañado o que no es imagen), se avisa aquí; el servidor igual la rechazaría. */}
        {previaVisible && (
          <AjusteFoto key={previa.url} url={previa.url} alFallar={() => {
            setPrevia(null);
            setErrorLocal("No pudimos mostrar esta imagen. Prueba con otra foto JPEG, PNG o WebP.");
          }} />
        )}
        <MensajeFormulario estado={estadoFotoVisible} />
        <button type="submit" disabled={subiendo} className={claseBoton}>
          {subiendo ? "Subiendo…" : "Subir foto"}
        </button>
      </form>

      <form action={accionEstilo} className="space-y-4">
        {/* fieldset + legend: el lector de pantalla anuncia "Estilo" al entrar al grupo de radios. */}
        <fieldset>
          <legend className={claseEtiqueta}>Estilo</legend>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada opción muestra cómo quedaría tu avatar generado con ese estilo.
            {foto && " Mientras uses tu foto, el estilo que elijas se guarda para cuando vuelvas al avatar generado."}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {opciones.map((o) => (
              // La tarjeta entera es la <label>: un clic en cualquier parte marca su radio. has-checked: y
              // has-focus-visible: (Tailwind 4, CSS :has()) pintan la tarjeta según el estado del radio que contiene.
              <label key={o.estilo}
                     className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center text-sm transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                {/* sr-only: el círculo del radio no se ve, pero sigue ahí para el teclado (flechas) y el lector de pantalla. */}
                <input type="radio" name="estilo" value={o.estilo} defaultChecked={o.estilo === actual.estilo} required className="sr-only" />
                {/* alt="": el nombre del estilo ya es el texto de la opción; describir el dibujo no aporta. */}
                <Image src={o.url} alt="" width={64} height={64} unoptimized className="size-16 rounded-full bg-muted" />
                {o.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <MensajeFormulario estado={estadoEstilo} />
        <button type="submit" disabled={guardando} className={claseBoton}>
          {guardando ? "Guardando…" : "Usar este estilo"}
        </button>
      </form>
    </div>
  );
}
