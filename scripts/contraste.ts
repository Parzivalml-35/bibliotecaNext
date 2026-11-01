// R6: mide el contraste WCAG 2 de las combinaciones de tokens que usan las pantallas, en los tres temas, leyendo
// app/globals.css (los valores reales, no los de la ficha). Termina con código 1 si alguna no llega al mínimo.
// Uso: pnpm diseno:contraste   (después de cambiar cualquier color de globals.css)
import { readFileSync } from "node:fs";

type Rgb = [number, number, number];
type Tokens = Record<string, string>;

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

// Tokens de un selector: :root (tema claro + derivados) o [data-tema="…"]. Junta TODOS los bloques con ese selector
// (las luces de la Fase A están en un segundo :root, al final de globals.css).
function bloque(selector: string): Tokens {
  const tokens: Tokens = {};
  for (let inicio = css.indexOf(`${selector} {`); inicio >= 0; inicio = css.indexOf(`${selector} {`, inicio + 1)) {
    for (const m of css.slice(inicio, css.indexOf("}", inicio)).matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  }
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
// La transparencia propia del color (`oklch(L C h / a)`) se lee aparte con alfaDe().
function alfaDe(texto: string): number {
  const partes = texto.match(/oklch\(([^)]+)\)/)![1].split("/");
  return partes[1] ? Number(partes[1]) : 1;
}
function oklchARgb(texto: string): Rgb {
  const [L, C, h] = texto.match(/oklch\(([^)]+)\)/)![1].split("/")[0].trim().split(/\s+/).map(Number);
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
// Un token con transparencia propia (las luces de la Fase A) se mezcla con lo de abajo con su alfa.
function color(tokens: Tokens, capa: string): Rgb {
  // Se corta en el PRIMER "@": lo de abajo puede ser otra capa ("card/85@lampara-sombra@background").
  const corte = capa.indexOf("@");
  const [arriba, abajo] = corte < 0 ? [capa, undefined] : [capa.slice(0, corte), capa.slice(corte + 1)];
  const [nombre, porcentaje] = arriba.split("/");
  const valor = resolver(tokens, nombre);
  const rgb = oklchARgb(valor);
  const alfa = (porcentaje ? Number(porcentaje) / 100 : 1) * alfaDe(valor);
  if (alfa === 1) return rgb;
  if (!abajo) throw new Error(`"${capa}" es transparente: falta "@fondo"`);
  const fondo = color(tokens, abajo);
  return rgb.map((v, i) => alfa * v + (1 - alfa) * fondo[i]) as Rgb;
}

// [uso, texto o elemento, lo que hay detrás, mínimo, solo en este tema]. 4.5: texto normal (1.4.3). 3: contorno de
// un componente o del foco (1.4.11). Si una pantalla usa una combinación nueva, se agrega aquí.
type Par = [string, string, string, number, string?];
const PARES: Par[] = [
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
  // Fase A (DI-14): texto que va sobre la pared, en los extremos de la luz de cada tema. Cada luz existe solo en su
  // tema. Aproximación: la capa más fuerte de cada extremo; donde se superponen degradados la luz aclara aún más.
  ["Texto sobre la sombra entre haces de sol", "foreground", "sol-sombra@background", 4.5, "claro"],
  ["Secundario sobre la sombra entre haces de sol", "muted-foreground", "sol-sombra@background", 4.5, "claro"],
  ["Secundario sobre un haz de sol", "muted-foreground", "sol@background", 4.5, "claro"],
  ["Texto sobre un haz de luna", "foreground", "luna@background", 4.5, "oscuro"],
  ["Secundario sobre un haz de luna", "muted-foreground", "luna@background", 4.5, "oscuro"],
  ["Secundario sobre la sombra de la luna", "muted-foreground", "luna-sombra@background", 4.5, "oscuro"],
  ["Texto en la penumbra de la lámpara", "foreground", "lampara-sombra@background", 4.5, "lampara"],
  ["Secundario en la penumbra de la lámpara", "muted-foreground", "lampara-sombra@background", 4.5, "lampara"],
  ["Secundario bajo el foco de la lámpara", "muted-foreground", "lampara-nucleo@background", 4.5, "lampara"],
  ["Enlace primary en la penumbra de la lámpara", "primary", "lampara-sombra@background", 4.5, "lampara"],
  ["Ícono de la lámpara (barra) vs cápsula", "foreground", "card/85@lampara-sombra@background", 3, "lampara"],
];

let fallos = 0;
console.log("Uso".padEnd(46), "mín", "  claro  ", "lámpara", "  oscuro");
for (const [uso, delante, detras, minimo, soloTema] of PARES) {
  const celdas = Object.entries(TEMAS).map(([tema, tokens]) => {
    if (soloTema && soloTema !== tema) return "—".padStart(8);
    const valor = contraste(color(tokens, delante), color(tokens, detras));
    if (valor < minimo) fallos++;
    return `${valor < minimo ? "✗" : " "}${valor.toFixed(2)}`.padStart(8);
  });
  console.log(uso.padEnd(46), String(minimo).padEnd(3), ...celdas);
}
console.log(fallos === 0 ? "\nTodas las combinaciones cumplen." : `\n${fallos} combinaciones no llegan al mínimo.`);
process.exit(fallos === 0 ? 0 : 1);
