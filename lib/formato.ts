// "1 copia", "3 copias", "0 copias". El número y la palabra siempre concuerdan.
export function plural(cantidad: number, singular: string, enPlural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : enPlural}`;
}
