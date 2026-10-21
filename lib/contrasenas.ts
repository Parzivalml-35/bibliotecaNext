// RN-62: contraseñas con scrypt (incluido en Node, sin dependencias).
// Sin "server-only" a propósito: también lo usa scripts/claves-dev.ts, que corre con Node fuera de Next.
// No contiene secretos; node:crypto, de todos modos, no existe en el navegador.
// Sin alias "@/": Node ejecuta este archivo directamente y no conoce los alias de tsconfig.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

type Parametros = { N: number; r: number; p: number };

// Recomendación de OWASP para scrypt: N=2^17, r=8, p=1. Usa 128 * N * r = 128 MiB; en este equipo ~300 ms.
const PARAMETROS: Parametros = { N: 2 ** 17, r: 8, p: 1 };
const LARGO_CLAVE = 64; // bytes del hash
const LARGO_SAL = 16; // bytes aleatorios por contraseña
// Node limita scrypt a 32 MiB por defecto: sin subirlo, N=2^17 falla con "memory limit exceeded".
const MEMORIA_MAXIMA = 256 * 1024 * 1024;

function derivar(contrasena: string, sal: Buffer, parametros: Parametros, largo: number): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    // NFC: "ñ" puede escribirse como un carácter o como "n" + tilde combinable; sin normalizar,
    // la misma contraseña tecleada en otro dispositivo daría otro hash.
    scrypt(contrasena.normalize("NFC"), sal, largo, { ...parametros, maxmem: MEMORIA_MAXIMA }, (error, clave) =>
      error ? rechazar(error) : resolver(clave),
    );
  });
}

// Formato guardado en cuenta.password_hash (cabe en VARCHAR(255)):
//   scrypt$N=131072,r=8,p=1$<sal en base64>$<hash en base64>
// Los parámetros viajan con el hash: si mañana se endurecen, las contraseñas viejas siguen verificándose.
export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL);
  const clave = await derivar(contrasena, sal, PARAMETROS, LARGO_CLAVE);
  const { N, r, p } = PARAMETROS;
  return `scrypt$N=${N},r=${r},p=${p}$${sal.toString("base64")}$${clave.toString("base64")}`;
}

// true solo si la contraseña corresponde al hash guardado. Cualquier formato raro (por ejemplo, el
// marcador '!pendiente-fase-3' del seed) devuelve false en vez de lanzar un error.
export async function verificarContrasena(contrasena: string, guardado: string): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 4 || partes[0] !== "scrypt") return false;

  const parametros = Object.fromEntries(partes[1].split(",").map((par) => par.split("=")));
  const N = Number(parametros.N);
  const r = Number(parametros.r);
  const p = Number(parametros.p);
  if (![N, r, p].every(Number.isInteger)) return false;

  const sal = Buffer.from(partes[2], "base64");
  const esperado = Buffer.from(partes[3], "base64");
  const calculado = await derivar(contrasena, sal, { N, r, p }, esperado.length);

  // Comparación en tiempo constante: tarda lo mismo acierte o no, y no filtra cuántos bytes coincidieron.
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
