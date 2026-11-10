import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioAvatar, type OpcionAvatar } from "@/components/formularios-avatar";
import { FormularioContacto } from "@/components/formularios-lector";
import { ESTILOS_AVATAR, esEstiloAvatar, NOMBRES_ESTILO, urlDeAvatar } from "@/lib/avatar";
import { maxKbAvatar } from "@/lib/data/avatar";
import { listarCiudades, obtenerPerfilDeLector } from "@/lib/data/lectores";
import { exigirLector, obtenerUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Perfil" };

const NOMBRE_DOCUMENTO: Record<string, string> = {
  CC: "Cédula", TI: "Tarjeta de identidad", CE: "Cédula de extranjería", PASAPORTE: "Pasaporte",
};

// Pestaña "Perfil" (DI-10, RN-77). Arriba, los datos verificados en mostrador, solo para leer; abajo, el contacto,
// que el lector cambia solo; al final, el avatar (RN-81 generado, RN-82 foto). El tema se suma aquí en R7h.
export default async function PaginaPerfil() {
  const lector = await exigirLector("/cuenta/perfil"); // RN-83
  // Las dos consultas no dependen una de la otra: Promise.all las lanza a la vez en lugar de una tras otra.
  const [perfil, ciudades, maxKb] = await Promise.all([obtenerPerfilDeLector(lector.idLector), listarCiudades(), maxKbAvatar()]);
  if (!perfil) notFound(); // no debería pasar: la sesión ya comprobó que el lector existe
  // El avatar es de la cuenta y ya viene en la sesión (obtenerUsuario está en cache(): no consulta otra vez).
  const { avatar } = (await obtenerUsuario())!;
  // Un estilo que ya no está en la lista se muestra (y se marca) como el primero, igual que lo dibuja urlDeAvatar.
  const estiloActual = esEstiloAvatar(avatar.estilo) ? avatar.estilo : ESTILOS_AVATAR[0];
  // Cada opción con la semilla ACTUAL: así se ve cómo quedaría el mismo avatar en otro estilo.
  const opciones: OpcionAvatar[] = ESTILOS_AVATAR.map((estilo) => ({
    estilo, nombre: NOMBRES_ESTILO[estilo], url: urlDeAvatar({ estilo, semilla: avatar.semilla }),
  }));

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

      <section aria-labelledby="avatar" className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 id="avatar" className="font-heading text-lg font-semibold">Avatar</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Lo dibujamos al azar en nuestro servidor: no sale de tu nombre ni de tu correo. Puedes generar otro, cambiar el
          estilo o usar una foto tuya.
        </p>
        {/* foto: con clave, urlDeAvatar devuelve la ruta de la foto; sin ella, null (el formulario muestra el generado). */}
        <FormularioAvatar actual={opciones.find((o) => o.estilo === estiloActual)!} opciones={opciones}
                          foto={avatar.clave ? urlDeAvatar(avatar) : null} maxKb={maxKb} />
      </section>
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
