// RN-92: el apodo, nombre PÚBLICO de la cuenta. Sin "server-only": lo usan el formulario (para avisar antes de enviar)
// y las acciones (que validan otra vez: una Server Action recibe lo que cualquiera le envíe).
//
// La regla final la pone la BD (ck_cuenta_apodo con REGEXP_LIKE y uq_cuenta_apodo); esta es la misma en JavaScript,
// para dar un mensaje claro en lugar del error de MySQL.

export const LARGO_MINIMO_APODO = 3;
export const LARGO_MAXIMO_APODO = 30;

// \p{L} = cualquier letra (con tilde, ñ…), \p{N} = cualquier dígito; la bandera u hace que {3,30} cuente caracteres y
// no unidades de UTF-16. Equivale a [[:alnum:]_.-] de MySQL 8 (ICU), comprobado en la BD con "José_1.x" y "ñandú".
const FORMA_APODO = /^[\p{L}\p{N}_.-]{3,30}$/u;

export const AYUDA_APODO = `De ${LARGO_MINIMO_APODO} a ${LARGO_MAXIMO_APODO} caracteres: letras, números, punto, guion o guion bajo, sin espacios.`;

// NFC: "é" puede llegar como una letra o como "e" + tilde combinable (dos caracteres). Se lleva siempre a la forma de
// una letra, así la misma palabra se guarda igual y el UNIQUE la reconoce.
export function normalizarApodo(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().normalize("NFC") : "";
}

export function esApodoValido(apodo: string): boolean {
  return FORMA_APODO.test(apodo);
}

// El apodo que propone el registro: "lector-" y 6 dígitos al azar (la misma forma que el DEFAULT de la columna).
// crypto.getRandomValues existe en el navegador y en Node: el número no se puede adivinar ni sale del correo o del id.
export function apodoGenerado(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return `lector-${String(n % 1_000_000).padStart(6, "0")}`;
}
