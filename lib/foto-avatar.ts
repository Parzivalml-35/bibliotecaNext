import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// RN-82: la foto de avatar, del archivo que sube el navegador al WebP que se guarda. Sin SQL: la parte de la BD está en
// lib/data/avatar.ts y la orquestación (qué se hace primero, qué se borra si algo falla) en lib/actions/avatar.ts.

// Fuera de public/ (Next no la sirve sola): la entrega una ruta que exige sesión (R7g2). storage/ no va a git.
const CARPETA = path.join(process.cwd(), "storage", "avatares");

// Nombre aleatorio: 16 bytes en base64url (22 caracteres) + ".webp". No sale del id ni del correo, así que la URL no
// revela de quién es, y cada foto nueva tiene una URL nueva (la caché del navegador nunca muestra una vieja).
// Toda clave se valida con esta forma ANTES de tocar el disco: con "../" podría salir de la carpeta (path traversal).
export const FORMA_CLAVE_FOTO = /^[A-Za-z0-9_-]{22}\.webp$/;

const LADO = 256; // px del cuadrado final (RN-82)

// Lo que sharp dice que es el archivo, mirando su CONTENIDO (los primeros bytes, la "firma"), no el nombre ni el tipo
// que mandó el navegador: ambos los escribe el cliente. Un SVG renombrado a .png llega aquí como "svg" y se rechaza.
const FORMATOS_PERMITIDOS = new Set(["jpeg", "png", "webp"]);

// Tope de píxeles del archivo de entrada. Un PNG de pocos KB puede declarar 50 000 × 50 000 píxeles (una "bomba de
// descompresión"): sharp lo rechaza al leer la cabecera, sin reservar la memoria. 50 millones cubre la cámara de un
// celular de 48 MP; el valor por defecto de sharp (268 millones) es demasiado para una foto de perfil.
const MAX_PIXELES = 50_000_000;

export type ResultadoFoto = { webp: Buffer } | { error: string };

// Valida y vuelve a codificar. Devuelve el WebP listo para guardar o el mensaje para el usuario.
export async function procesarFoto(archivo: File, maxKb: number): Promise<ResultadoFoto> {
  // Primero el tamaño (lo declara el propio cuerpo de la petición, ya recibido): no se le pasa a sharp nada más grande.
  if (archivo.size > maxKb * 1024) {
    // En MB desde 1024 KB (2048 → "2 MB", 1536 → "1,5 MB"); por debajo, en KB: el valor viene de la BD y puede ser chico.
    const limite = maxKb >= 1024 ? `${(maxKb / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB` : `${maxKb} KB`;
    return { error: `La foto pesa más de ${limite}. Elige una más liviana.` };
  }

  const entrada = Buffer.from(await archivo.arrayBuffer());
  try {
    // autoOrient: aplica la orientación EXIF (la foto del celular "acostada") ANTES de que los metadatos desaparezcan;
    // sin esto, al borrar el EXIF la foto quedaría de lado. failOn "warning" (el valor por defecto, explícito aquí):
    // ante datos dañados, sharp falla en vez de adivinar; es lo que recomienda para entradas de desconocidos.
    const imagen = sharp(entrada, { limitInputPixels: MAX_PIXELES, autoOrient: true, failOn: "warning" });

    const { format } = await imagen.metadata();
    if (!FORMATOS_PERMITIDOS.has(format)) {
      return { error: "La foto debe ser JPEG, PNG o WebP." };
    }

    // fit "cover": llena el cuadrado y recorta lo que sobra (centrado). Volver a codificar es la defensa principal:
    // lo que se guarda son píxeles nuevos escritos por sharp, no el archivo recibido. Sin keepMetadata(), sharp no copia
    // EXIF, XMP ni IPTC (ahí viaja la ubicación GPS). Un WebP o PNG animado: sharp lee solo el primer cuadro.
    const webp = await imagen.resize(LADO, LADO, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    return { webp };
  } catch {
    // Archivo dañado, truncado, demasiados píxeles o un formato que sharp no entiende: el mismo mensaje para todos.
    return { error: "No pudimos leer la imagen. Prueba con otra foto JPEG, PNG o WebP." };
  }
}

// Guarda el WebP con un nombre nuevo y devuelve la clave para la BD. flag "wx": falla si el archivo ya existe en vez de
// pisarlo (con 128 bits aleatorios no debería pasar nunca, pero si pasa es mejor un error que mezclar dos fotos).
export async function guardarFoto(webp: Buffer): Promise<string> {
  const clave = `${randomBytes(16).toString("base64url")}.webp`;
  await mkdir(CARPETA, { recursive: true }); // la primera vez en un equipo nuevo la carpeta no existe
  await writeFile(path.join(CARPETA, clave), webp, { flag: "wx" });
  return clave;
}

// Lee una foto para entregarla (app/avatar/foto/[clave]/route.ts). null si la clave no tiene la forma esperada o el
// archivo no está (por ejemplo, la BD vino de otro equipo: storage/ no va a git y la cuenta nombra una foto que aquí no hay).
export async function leerFoto(clave: string): Promise<Buffer | null> {
  if (!FORMA_CLAVE_FOTO.test(clave)) return null;
  try {
    return await readFile(path.join(CARPETA, clave));
  } catch {
    return null;
  }
}

// Borra una foto que ya no usa ninguna cuenta. No lanza: se llama DESPUÉS del COMMIT, cuando la BD ya cambió, y un
// archivo que no se pudo borrar solo ocupa espacio (no lo sirve nadie, porque ninguna cuenta lo nombra).
export async function borrarFoto(clave: string): Promise<void> {
  if (!FORMA_CLAVE_FOTO.test(clave)) {
    console.error(`Clave de foto con forma inesperada, no se borra: ${JSON.stringify(clave)}`);
    return;
  }
  try {
    await unlink(path.join(CARPETA, clave));
  } catch (error) {
    // ENOENT = ya no estaba (por ejemplo, la BD se reconstruyó y storage/ no): no es un problema.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error(`No se pudo borrar la foto ${clave}:`, error);
  }
}
