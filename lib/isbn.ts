// Mismo formato que el CHECK ck_libro_isbn de la BD: ISBN-10 (9 dígitos + dígito o X) o ISBN-13, sin guiones.
const FORMATO_ISBN = /^(\d{9}[\dX]|\d{13})$/;

export function esIsbnValido(texto: string): boolean {
  return FORMATO_ISBN.test(texto);
}
