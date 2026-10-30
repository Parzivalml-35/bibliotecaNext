// R6: mide el contraste WCAG 2 de las combinaciones de tokens que usan las pantallas, en los tres temas, leyendo
// app/globals.css (los valores reales, no los de la ficha). Termina con código 1 si alguna no llega al mínimo.
// Uso: pnpm diseno:contraste   (después de cambiar cualquier color de globals.css)
import { readFileSync } from "node:fs";

type Rgb = [number, number, number];
type Tokens = Record<string, string>;

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

// Tokens de un bloque: :root (tema claro + derivados) o [data-tema="…"].
function bloque(selector: string): Tokens {
  const inicio = css.indexOf(`${selector} {`);
  const tokens: Tokens = {};
  for (const m of css.slice(inicio, css.indexOf("}", inicio)).matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  return tokens;
}
const raiz = bloque(":root");
// Los temas heredan los derivados de :root (var(--card) se resuelve con el valor del tema activo).
const TEMAS: Record<string, Tokens> = {
  claro: raiz,
  lampara: { ...raiz, ...bloque('[data-tema="lampara"]') },
  oscuro: { ...raiz, ...bloque('[data-tema="oscuro"]') },
};

function resolver(tokens: Tokens, nombre: string): string {
  let valor = tokens[nombre];
  for (let i = 0; valor?.startsWith("var(") && i < 5; i++) valor = tokens[valor.slice(6, -1)];
  if (!valor) throw new Error(`Token sin valor: --${nombre}`);
  return valor;
}

// oklch → sRGB codificado (0..1), recortado al gamut. Fórmulas de oklab (Björn Ottosson).
function oklchARgb(texto: string): Rgb {
  const [L, C, h] = texto.match(/oklch\(([^)]+)\)/)![1].trim().split(/\s+/).map(Number);
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lineal = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lineal.map((v) => Math.min(1, Math.max(0, v))).map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) as Rgb;
}
const decodificar = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminancia = (c: Rgb) => 0.2126 * decodificar(c[0]) + 0.7152 * decodificar(c[1]) + 0.0722 * decodificar(c[2]);
function contraste(x: Rgb, y: Rgb): number {
  const [claro, oscuro] = [luminancia(x), luminancia(y)].sort((p, q) => q - p);
  return (claro + 0.05) / (oscuro + 0.05);
}

// Una capa: "card", o "input/30@card" (el token al 30 % de opacidad sobre card, como bg-input/30 en una tarjeta).
function color(tokens: Tokens, capa: string): Rgb {
  const [arriba, abajo] = capa.split("@");
  const [nombre, porcentaje] = arriba.split("/");
  const rgb = oklchARgb(resolver(tokens, nombre));
  if (!porcentaje) return rgb;
  const alfa = Number(porcentaje) / 100, fondo = color(tokens, abajo);
  return rgb.map((v, i) => alfa * v + (1 - alfa) * fondo[i]) as Rgb;
}

// [uso, texto o elemento, lo que hay detrás, mínimo]. 4.5: texto normal (1.4.3). 3: contorno de un componente o
// del foco (1.4.11). Si una pantalla usa una combinación nueva, se agrega aquí.
const PARES: [string, string, string, number][] = [
  ["Texto principal sobre el fondo", "foreground", "background", 4.5],
  ["Texto principal en tarjeta", "foreground", "card", 4.5],
  ["Texto principal en bandeja (muted)", "foreground", "muted", 4.5],
  ["Secundario sobre el fondo", "muted-foreground", "background", 4.5],
  ["Secundario en tarjeta", "muted-foreground", "card", 4.5],
  ["Secundario en bandeja (encabezado de tabla)", "muted-foreground", "muted", 4.5],
  ["Placeholder del campo", "muted-foreground", "input/30@card", 4.5],
  ["Texto del campo", "foreground", "input/30@card", 4.5],
  ["Botón principal", "primary-foreground", "primary", 4.5],
  ["Texto primary en tarjeta (variante link)", "primary", "card", 4.5],
  ["Pestaña activa", "accent-foreground", "accent", 4.5],
  ["Badge secondary", "secondary-foreground", "secondary", 4.5],
  ["Botón destructive y Badge danger", "danger-texto", "danger-suave", 4.5],
  ["Badge success", "success-texto", "success-suave", 4.5],
  ["Badge warning", "warning-texto", "warning-suave", 4.5],
  ["Badge info", "info-texto", "info-suave", 4.5],
  ["Mensaje de acción ok, en tarjeta", "success-texto", "card", 4.5],
  ["Mensaje de acción error, en tarjeta", "danger-texto", "card", 4.5],
  ["Aviso warning sobre el fondo", "warning-texto", "background", 4.5],
  ["Borde del campo vs tarjeta", "borde-campo", "card", 3],
  ["Borde del campo vs bandeja", "borde-campo", "muted", 3],
  ["Borde del campo vs fondo", "borde-campo", "background", 3],
  ["Contorno de foco en tarjeta", "ring", "card", 3],
  ["Contorno de foco sobre el fondo", "ring", "background", 3],
  ["Borde warning (alertas) vs tarjeta", "warning", "card", 3],
  ["Borde danger vs tarjeta", "danger", "card", 3],
  ["Borde primary (hover de tarjeta) vs tarjeta", "primary", "card", 3],
];

let fallos = 0;
console.log("Uso".padEnd(46), "mín", "  claro  ", "lámpara", "  oscuro");
for (const [uso, delante, detras, minimo] of PARES) {
  const celdas = Object.values(TEMAS).map((tokens) => {
    const valor = contraste(color(tokens, delante), color(tokens, detras));
    if (valor < minimo) fallos++;
    return `${valor < minimo ? "✗" : " "}${valor.toFixed(2)}`.padStart(8);
  });
  console.log(uso.padEnd(46), String(minimo).padEnd(3), ...celdas);
}
console.log(fallos === 0 ? "\nTodas las combinaciones cumplen." : `\n${fallos} combinaciones no llegan al mínimo.`);
process.exit(fallos === 0 ? 0 : 1);
