import { porcentajeDeAvance } from "@/components/cuenta/avance-lectura";
import { NavegacionLecturas } from "@/components/cuenta/navegacion-lecturas";
import { listarLibrosLeidos } from "@/lib/data/lectura";
import { obtenerUsuario } from "@/lib/sesion";

// RN-89: la lista de libros de "Mis lecturas", en el layout (se queda en pantalla al elegir un libro). Mismo patrón que
// MenuPanel: Server Component asíncrono (lee la sesión y la BD), envuelto en <Suspense> por el layout. Mostrar la lista
// es comodidad; la protección está en cada página (exigirLector) y en cada acción (RN-35).
// Decide QUÉ libros (en el servidor); NavegacionLecturas marca el activo (con la ruta, en el cliente).
export async function ListaLecturas() {
  const usuario = await obtenerUsuario();
  if (!usuario?.lector) return null; // la página redirige al login
  const libros = await listarLibrosLeidos(usuario.lector.idLector); // cache(): la página reutiliza este resultado
  if (libros.length === 0) return null; // la página muestra el estado vacío

  // Al cliente solo cruzan objetos simples (lo que se dibuja), no la fila entera.
  return (
    <NavegacionLecturas libros={libros.map((l) => ({
      isbn: l.isbn, titulo: l.titulo, autores: l.autores, avance: porcentajeDeAvance(l),
    }))} />
  );
}
