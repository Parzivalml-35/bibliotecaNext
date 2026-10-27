import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { borrarSesion, buscarSesionVigente, insertarSesion } from "@/lib/data/sesiones";
import type { EmpleadoSesion, LectorSesion, UsuarioSesion } from "@/lib/definitions";
import { inicioDe, type Permiso, tienePermiso } from "@/lib/permisos";

// Capa de acceso a la sesión (la "DAL" de la guía de autenticación de Next). Todo lo que necesite saber
// quién está conectado pasa por aquí: páginas, layouts y Server Actions. RN-35, RN-63, RN-64.

const NOMBRE_COOKIE = "sesion";

// La BD guarda el SHA-256 del token, nunca el token (RN-63): quien lea la tabla `sesion` (un respaldo, una
// inyección SQL) no puede hacerse pasar por nadie. Para un token aleatorio de 256 bits basta un hash rápido;
// scrypt (lento a propósito) solo hace falta con contraseñas, que las personas eligen y se pueden adivinar.
function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Solo se llama desde Server Actions: cookies().set() no funciona mientras se renderiza un componente.
export async function crearSesion(idCuenta: number): Promise<void> {
  const token = randomBytes(32).toString("base64url"); // 32 bytes del generador seguro del sistema
  const horas = await insertarSesion(idCuenta, hashDeToken(token));

  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, token, {
    httpOnly: true, // el JavaScript de la página no puede leerla (un XSS no se la roba)
    sameSite: "lax", // no viaja en peticiones POST desde otros sitios (CSRF)
    secure: process.env.NODE_ENV === "production", // solo HTTPS; en desarrollo localhost es http
    path: "/",
    maxAge: horas * 60 * 60, // en segundos; la BD tiene la fecha real, esto solo limpia el navegador
  });
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE)?.value;
  if (token) await borrarSesion(hashDeToken(token)); // RN-64: cerrar sesión borra la fila
  almacen.delete(NOMBRE_COOKIE);
}

// Quién está conectado, o null. cache() (de React) memoriza el resultado DURANTE una petición: el layout,
// la página y sus componentes pueden llamarla las veces que quieran y la BD se consulta una sola vez.
// Lee la cookie y la compara con la BD en cada petición: desactivar una cuenta o un empleado la deja
// fuera en la siguiente (RN-64), sin esperar a que venza la cookie.
export const obtenerUsuario = cache(async (): Promise<UsuarioSesion | null> => {
  const token = (await cookies()).get(NOMBRE_COOKIE)?.value;
  if (!token) return null;

  const fila = await buscarSesionVigente(hashDeToken(token));
  if (!fila) return null;

  return {
    idCuenta: fila.id_cuenta,
    correo: fila.correo,
    empleado:
      fila.id_empleado === null
        ? null
        : {
            idEmpleado: fila.id_empleado,
            nombre: fila.nombre!,
            apellido: fila.apellido!,
            rol: fila.rol!,
            idSede: fila.id_sede,
            sede: fila.sede,
          },
    lector:
      fila.id_lector === null
        ? null
        : { idLector: fila.id_lector, nombre: fila.nombre_lector!, verificada: fila.verificada === 1 },
  };
});

// RN-83: ¿es una ruta de ESTE sitio? Devuelve la ruta normalizada o null. La usan la página de login (para el campo
// oculto) y la acción (que la vuelve a validar: una Server Action recibe lo que cualquiera le envíe).
// Las tres comprobaciones de RN-83 no bastan solas: el navegador borra tabuladores y saltos de línea de una URL, así
// que "/\t/otro.com" acabaría siendo "//otro.com". Por eso además se interpreta con URL contra un origen inventado:
// si el resultado cambia de origen, era otro sitio. Se devuelve lo interpretado, no el texto recibido.
// La misma regla se aplica OTRA VEZ al resultado: URL resuelve los ".." y "/..//otro.com" quedaría en "//otro.com".
const ORIGEN_DE_PRUEBA = "http://interno.invalid";
const pareceInterna = (ruta: string) => ruta.startsWith("/") && !ruta.startsWith("//") && !ruta.startsWith("/\\");
export function rutaInterna(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length > 2048 || !pareceInterna(valor)) return null;
  let url: URL;
  try {
    url = new URL(valor, ORIGEN_DE_PRUEBA);
  } catch {
    return null;
  }
  const ruta = url.pathname + url.search + url.hash;
  return url.origin === ORIGEN_DE_PRUEBA && pareceInterna(ruta) ? ruta : null;
}

// A dónde manda exigirLector/exigirEmpleado cuando falta la sesión o el perfil. `siguiente` es la ruta de la página
// que llama (RN-83): el servidor no conoce la URL actual, así que cada página pasa la suya.
function urlLogin(siguiente?: string, motivo?: string): string {
  const parametros = new URLSearchParams();
  if (motivo) parametros.set("motivo", motivo);
  const ruta = rutaInterna(siguiente);
  if (ruta) parametros.set("siguiente", ruta); // URLSearchParams codifica "/", "?" y "&" por nosotros
  const consulta = parametros.toString();
  return consulta ? `/login?${consulta}` : "/login";
}

// Para páginas y acciones del panel: devuelve el empleado o corta la petición. redirect() lanza una
// excepción especial que Next convierte en una redirección: el código de después no se ejecuta.
// `permiso` (de lib/permisos.ts, DI-11) restringe a los roles que lo tienen; sin él, basta con ser empleado activo.
// Sin permiso se vuelve al inicio del rol, que siempre es una página que el rol puede abrir.
// `siguiente` (RN-83): la ruta de la página, para volver a ella después del login. Las acciones no lo pasan.
export async function exigirEmpleado(permiso?: Permiso, siguiente?: string): Promise<EmpleadoSesion> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect(urlLogin(siguiente));
  if (!usuario.empleado) redirect(urlLogin(siguiente, "sin-panel"));
  const { rol } = usuario.empleado;
  if (permiso && !tienePermiso(rol, permiso)) redirect(`${inicioDe(rol)}?motivo=sin-permiso`);
  return usuario.empleado;
}

// Para páginas y acciones del lector ("Mi cuenta", reservar, pagar en línea). Devuelve también idCuenta,
// porque las comprobaciones de dueño (¿esta multa es mía?) se hacen contra la sesión, nunca contra el navegador.
export async function exigirLector(siguiente?: string): Promise<LectorSesion & { idCuenta: number }> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect(urlLogin(siguiente));
  if (!usuario.lector) redirect(urlLogin(siguiente, "sin-cuenta-lector"));
  return { ...usuario.lector, idCuenta: usuario.idCuenta };
}
