// "1 copia", "3 copias", "0 copias". El número y la palabra siempre concuerdan.
export function plural(cantidad: number, singular: string, enPlural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : enPlural}`;
}

// $30.000: pesos colombianos sin decimales, con el separador de miles de es-CO.
const formatoPesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export function pesos(monto: number): string {
  return formatoPesos.format(monto);
}

// "2026-11-04" → "4 de nov de 2026". Las fechas DATE llegan de MySQL como texto (DATE_FORMAT) para no depender de
// la zona horaria del servidor de Node; se interpretan en UTC y se formatean en UTC, así el día no se corre.
const formatoFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function fechaCorta(fechaIso: string): string {
  return formatoFecha.format(new Date(`${fechaIso}T00:00:00Z`));
}
