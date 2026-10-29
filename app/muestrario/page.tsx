import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotonAccion } from "@/components/boton-accion";
import { EstadoVacio } from "@/components/estado-vacio";
import { Portada } from "@/components/portada";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { claseBoton, claseCampo, claseEtiqueta, MensajeFormulario } from "@/components/ui-formulario";
import { obtenerPaginaDeLibros } from "@/lib/data/libros";
import type { EstadoFormulario } from "@/lib/definitions";

export const metadata: Metadata = { title: "Muestrario", robots: { index: false } };

// Acción de prueba para ver el mensaje de BotonAccion. No toca la BD ni lee nada. Sin parámetros: una función
// que recibe menos argumentos de los que se le pasan sigue cumpliendo el tipo Accion (TypeScript lo permite).
async function accionDePrueba(): Promise<EstadoFormulario> {
  "use server";
  if (process.env.NODE_ENV === "production") return {};
  return { exito: "Acción de prueba ejecutada" };
}

// Fase R: los componentes base en el tema activo (se cambia con el botón de la barra superior), para revisarlos
// antes de usarlos en las pantallas y para medir el contraste en R6. Solo existe en desarrollo.
export default async function PaginaMuestrario() {
  if (process.env.NODE_ENV === "production") notFound();
  const { libros } = await obtenerPaginaDeLibros(); // la primera página del catálogo, para ver portadas reales

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Muestrario</h1>
        <p className="mt-1 text-sm text-muted-foreground">Componentes de la Fase R. Cambia el tema arriba para ver los tres.</p>
      </div>

      <section aria-labelledby="etiquetas" className="space-y-3">
        <h2 id="etiquetas" className="text-lg font-semibold">Etiquetas (DI-09)</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Al día</Badge>
          <Badge variant="warning">Vence en 2 días</Badge>
          <Badge variant="danger">Vencido · 3 días</Badge>
          <Badge variant="info">Lista para recoger</Badge>
          <Badge variant="secondary">Declarado perdido</Badge>
          <Badge>Principal</Badge>
          <Badge variant="outline">Contorno</Badge>
        </div>
      </section>

      <section aria-labelledby="portadas" className="space-y-3">
        <h2 id="portadas" className="text-lg font-semibold">Portadas generadas (DI-05)</h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {libros.map((l) => (
            <Portada key={l.isbn} isbn={l.isbn} titulo={l.titulo} autores={l.autores} />
          ))}
        </div>
        <div className="flex items-end gap-4">
          {libros[0] && <Portada isbn={libros[0].isbn} titulo={libros[0].titulo} autores={libros[0].autores} className="w-16" />}
          {libros[0] && <Portada isbn={libros[0].isbn} titulo={libros[0].titulo} autores={libros[0].autores} className="w-48" />}
          <span className="text-xs text-muted-foreground">El texto escala con el ancho (unidades cqw).</span>
        </div>
      </section>

      <section aria-labelledby="tarjetas" className="space-y-3">
        <h2 id="tarjetas" className="text-lg font-semibold">Tarjetas y bandeja (DI-08)</h2>
        <div className="grid gap-4 rounded-2xl bg-muted p-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Cien años de soledad</CardTitle>
              <CardDescription>Gabriel García Márquez</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Sede Centro · vence el 12 nov</span>
              <Badge variant="success">Al día</Badge>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Tarjeta pequeña</CardTitle>
              <CardDescription>size=&quot;sm&quot;: menos espacio interno</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="danger">Vencido · 1 día</Badge>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="vacio" className="space-y-3">
        <h2 id="vacio" className="text-lg font-semibold">Estado vacío</h2>
        <EstadoVacio accion={<Button variant="outline" size="sm">Buscar un libro</Button>}>
          Aún no tienes préstamos.
        </EstadoVacio>
      </section>

      <section aria-labelledby="formularios" className="space-y-3">
        <h2 id="formularios" className="text-lg font-semibold">Formularios y mensajes</h2>
        <div className="max-w-sm space-y-4">
          <div>
            <label htmlFor="prueba-campo" className={claseEtiqueta}>Campo de texto</label>
            <input id="prueba-campo" placeholder="Escribe algo" className={claseCampo} />
          </div>
          <div>
            <label htmlFor="prueba-lista" className={claseEtiqueta}>Lista</label>
            <select id="prueba-lista" className={claseCampo}><option>Sede Centro</option><option>Sede Norte</option></select>
          </div>
          <button type="button" className={claseBoton}>Botón de formulario</button>
          <MensajeFormulario estado={{ error: "El ejemplar no está disponible." }} />
          <MensajeFormulario estado={{ exito: "Préstamo registrado." }} />
        </div>
      </section>

      <section aria-labelledby="botones" className="space-y-3">
        <h2 id="botones" className="text-lg font-semibold">Botones de acción</h2>
        <div className="flex flex-wrap items-start gap-3">
          <BotonAccion accion={accionDePrueba} campos={{}} etiqueta="Normal" etiquetaPendiente="…" />
          <BotonAccion accion={accionDePrueba} campos={{}} etiqueta="Principal" etiquetaPendiente="…" variante="principal" />
          <BotonAccion accion={accionDePrueba} campos={{}} etiqueta="Peligro" etiquetaPendiente="…" variante="peligro" />
        </div>
      </section>
    </div>
  );
}
