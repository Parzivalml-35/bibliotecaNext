import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { FormularioAvatar, type OpcionAvatar } from "@/components/formularios-avatar";
import { FormularioContrasena, FormularioCorreo } from "@/components/formularios-seguridad";
import { FormularioTema } from "@/components/formulario-tema";
import { ESTILOS_AVATAR, esEstiloAvatar, NOMBRES_ESTILO, urlDeAvatar } from "@/lib/avatar";
import { maxKbAvatar } from "@/lib/data/avatar";
import { obtenerUsuario } from "@/lib/sesion";
import { resolverPreferencia } from "@/lib/tema";

// Las secciones de la CUENTA (RN-31): avatar (RN-81, RN-82), tema (DI-04), contraseña (RN-78) y correo (RN-79). Las usan
// /cuenta/perfil y /cuenta/seguridad (lector) y /panel/perfil (empleado, R7i), con el mismo texto y los mismos
// formularios. Server Components asíncronos: cada uno lee lo que necesita. NO verifican quién entra: eso lo hace la
// página (exigirLector o exigirEmpleado) antes de mostrarlas; aquí, sin sesión, simplemente no se muestran.
// obtenerUsuario está en cache(): aunque cada sección lo llame, la sesión se consulta una sola vez por petición.

// El marco de cada sección. aria-labelledby: el lector de pantalla anuncia la región con el texto del <h2>.
function Seccion({ id, titulo, ayuda, children }: { id: string; titulo: string; ayuda: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-card p-5">
      <h2 id={id} className="font-heading text-lg font-semibold">{titulo}</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{ayuda}</p>
      {children}
    </section>
  );
}

export async function SeccionAvatar() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  const { avatar } = usuario;
  const maxKb = await maxKbAvatar();
  // Un estilo que ya no está en la lista se muestra (y se marca) como el primero, igual que lo dibuja urlDeAvatar.
  const estiloActual = esEstiloAvatar(avatar.estilo) ? avatar.estilo : ESTILOS_AVATAR[0];
  // Cada opción con la semilla ACTUAL: así se ve cómo quedaría el mismo avatar en otro estilo.
  const opciones: OpcionAvatar[] = ESTILOS_AVATAR.map((estilo) => ({
    estilo, nombre: NOMBRES_ESTILO[estilo], url: urlDeAvatar({ estilo, semilla: avatar.semilla }),
  }));

  return (
    <Seccion id="avatar" titulo="Avatar"
             ayuda="Lo dibujamos al azar en nuestro servidor: no sale de tu nombre ni de tu correo. Puedes generar otro, cambiar el estilo o usar una foto tuya.">
      {/* foto: con clave, urlDeAvatar devuelve la ruta de la foto; sin ella, null (el formulario muestra el generado). */}
      <FormularioAvatar actual={opciones.find((o) => o.estilo === estiloActual)!} opciones={opciones}
                        foto={avatar.clave ? urlDeAvatar(avatar) : null} maxKb={maxKb} />
    </Seccion>
  );
}

// DI-04 (R7h): la preferencia de ESTE equipo (sus cookies), para que el formulario llegue marcado desde el servidor.
// Las páginas que la usan ya son dinámicas (leen la sesión), así que leer cookies() aquí no cambia nada.
// toString() da "tema=oscuro; lampara=encendida; …", la misma forma que document.cookie.
export async function SeccionTema() {
  const temaDelEquipo = resolverPreferencia((await cookies()).toString());
  return (
    <Seccion id="tema" titulo="Tema" ayuda="Se aplica al instante y lo guardamos en tu cuenta: al entrar desde otro equipo se usará el mismo.">
      <FormularioTema inicial={temaDelEquipo} />
    </Seccion>
  );
}

export async function SeccionContrasena() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  return (
    <Seccion id="contrasena" titulo="Contraseña"
             ayuda="Para cambiarla necesitas la actual. Si la olvidaste, cierra sesión y usa «¿Olvidaste tu contraseña?» en el inicio de sesión.">
      <FormularioContrasena correo={usuario.correo} />
    </Seccion>
  );
}

export async function SeccionCorreo() {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  return (
    <Seccion id="correo" titulo="Correo"
             ayuda={<>Tu correo es <span className="font-medium text-foreground break-words">{usuario.correo}</span>. Te enviaremos un
               enlace al correo nuevo; el cambio se hace cuando lo abras.</>}>
      <FormularioCorreo />
    </Seccion>
  );
}
