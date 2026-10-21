import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { borrarSesion, buscarSesionVigente, insertarSesion } from "@/lib/data/sesiones";
import type { EmpleadoSesion, LectorSesion, RolEmpleado, UsuarioSesion } from "@/lib/definitions";

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

// Para páginas y acciones del panel: devuelve el empleado o corta la petición. redirect() lanza una
// excepción especial que Next convierte en una redirección: el código de después no se ejecuta.
// `roles` restringe a ciertos roles (RN-33); sin él, basta con ser empleado activo.
export async function exigirEmpleado(roles?: RolEmpleado[]): Promise<EmpleadoSesion> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  if (!usuario.empleado) redirect("/login?motivo=sin-panel");
  if (roles && !roles.includes(usuario.empleado.rol)) redirect("/panel?motivo=sin-permiso");
  return usuario.empleado;
}

// Para páginas y acciones del lector ("Mi cuenta", reservar, pagar en línea). Devuelve también idCuenta,
// porque las comprobaciones de dueño (¿esta multa es mía?) se hacen contra la sesión, nunca contra el navegador.
export async function exigirLector(): Promise<LectorSesion & { idCuenta: number }> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/login");
  if (!usuario.lector) redirect("/login?motivo=sin-cuenta-lector");
  return { ...usuario.lector, idCuenta: usuario.idCuenta };
}
