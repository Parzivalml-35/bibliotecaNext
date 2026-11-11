import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioContacto } from "@/components/formularios-lector";
import { SeccionAvatar, SeccionTema } from "@/components/secciones-cuenta";
import { listarCiudades, obtenerPerfilDeLector } from "@/lib/data/lectores";
import { exigirLector } from "@/lib/sesion";

export const metadata: Metadata = { title: "Perfil" };

const NOMBRE_DOCUMENTO: Record<string, string> = {
  CC: "Cédula", TI: "Tarjeta de identidad", CE: "Cédula de extranjería", PASAPORTE: "Pasaporte",
};

// Pestaña "Perfil" (DI-10, RN-77). Arriba, los datos verificados en mostrador, solo para leer; abajo, el contacto,
// que el lector cambia solo; después, el avatar (RN-81 generado, RN-82 foto) y el tema (DI-04, R7h).
export default async function PaginaPerfil() {
  const lector = await exigirLector("/cuenta/perfil"); // RN-83
  // Las dos consultas no dependen una de la otra: Promise.all las lanza a la vez en lugar de una tras otra.
  const [perfil, ciudades] = await Promise.all([obtenerPerfilDeLector(lector.idLector), listarCiudades()]);
  if (!perfil) notFound(); // no debería pasar: la sesión ya comprobó que el lector existe

  // "1995-05-05" → "5 de mayo de 1995". T00:00:00Z + timeZone UTC: la fecha no se corre un día por la zona horaria.
  const nacimiento = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${perfil.fecha_nacimiento}T00:00:00Z`));

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Perfil</h1>

      <section aria-labelledby="datos-verificados" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="datos-verificados" className="font-heading text-lg font-semibold">Tus datos</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Nombre" valor={`${perfil.nombre} ${perfil.apellido}`} />
          <Dato etiqueta="Correo" valor={perfil.correo} />
          <Dato etiqueta="Documento" valor={`${NOMBRE_DOCUMENTO[perfil.tipo_documento] ?? perfil.tipo_documento} ${perfil.numero_documento}`} />
          <Dato etiqueta="Fecha de nacimiento" valor={nacimiento} />
        </dl>
        {/* RN-77: estos datos se verificaron con el documento original (D-03); por eso no se editan aquí. */}
        <p className="mt-4 text-sm text-muted-foreground">
          Para corregir tu nombre, tu documento o tu fecha de nacimiento, acércate con tu documento a cualquier sede.
          El correo y la contraseña se cambian en Seguridad.
        </p>
      </section>

      <section aria-labelledby="contacto" className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 id="contacto" className="font-heading text-lg font-semibold">Contacto</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Lo usamos para contactarte si un préstamo vence y no lo has devuelto.</p>
        <FormularioContacto
          ciudades={ciudades}
          // Como texto: los <input> y <select> trabajan con strings. id_ciudad y el código postal vacío se convierten aquí.
          actuales={{
            telefono: perfil.telefono,
            calle: perfil.calle,
            codigo_postal: perfil.codigo_postal ?? "",
            id_ciudad: String(perfil.id_ciudad),
          }}
        />
      </section>

      {/* Avatar y tema son de la cuenta: las mismas secciones que /panel/perfil (components/secciones-cuenta.tsx). */}
      <div className="mt-6 space-y-6">
        <SeccionAvatar />
        <SeccionTema />
      </div>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      {/* break-words: un correo largo se parte en vez de salirse de la tarjeta en el celular. */}
      <dd className="mt-0.5 font-medium break-words">{valor}</dd>
    </div>
  );
}
