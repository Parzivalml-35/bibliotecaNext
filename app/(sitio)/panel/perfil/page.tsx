import type { Metadata } from "next";
import { SeccionAvatar, SeccionContrasena, SeccionCorreo, SeccionTema } from "@/components/secciones-cuenta";
import { NOMBRE_ROL } from "@/lib/permisos";
import { exigirEmpleado, obtenerUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi perfil" };

// DI-10 (R7i): el perfil del EMPLEADO. El avatar, el tema y la seguridad son de la cuenta (RN-31), así que son las
// mismas secciones que /cuenta/perfil y /cuenta/seguridad, y las mismas acciones (piden cualquier sesión). Sin
// permiso en exigirEmpleado: todo rol la abre. No tiene pestaña en el panel ("sin sección"): se llega desde el menú
// de la cuenta. Aquí no van el contacto ni los datos verificados: son del perfil de LECTOR (RN-77).
export default async function PaginaPerfilEmpleado() {
  const empleado = await exigirEmpleado(undefined, "/panel/perfil"); // RN-35, RN-83
  // exigirEmpleado ya garantizó la sesión; obtenerUsuario está en cache(): no vuelve a consultar la BD.
  const { correo } = (await obtenerUsuario())!;

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Mi perfil</h1>

      <section aria-labelledby="datos-empleado" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="datos-empleado" className="font-heading text-lg font-semibold">Tus datos</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Nombre" valor={`${empleado.nombre} ${empleado.apellido}`} />
          <Dato etiqueta="Correo" valor={correo} />
          <Dato etiqueta="Rol" valor={NOMBRE_ROL[empleado.rol]} />
          {/* RN-34: el administrador de red no tiene sede. */}
          <Dato etiqueta="Sede" valor={empleado.sede ?? "Toda la red"} />
        </dl>
        {/* El nombre, el rol y la sede los administra la red (empleados, fase de administración). */}
        <p className="mt-4 text-sm text-muted-foreground">
          Para corregir tu nombre, tu rol o tu sede, habla con el administrador de la red. El correo y la contraseña se
          cambian más abajo.
        </p>
      </section>

      <div className="mt-6 space-y-6">
        <SeccionAvatar />
        <SeccionTema />
        <SeccionContrasena />
        <SeccionCorreo />
      </div>
    </>
  );
}

// El mismo bloque que en /cuenta/perfil: son dos usos, se deja local en cada página.
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      {/* break-words: un correo largo se parte en vez de salirse de la tarjeta en el celular. */}
      <dd className="mt-0.5 font-medium break-words">{valor}</dd>
    </div>
  );
}
