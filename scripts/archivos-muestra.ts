// Genera PDFs de muestra en storage/libros/ para las ediciones digitales del seed (RN-29, RN-54).
// Uso: pnpm archivos:muestra   (en cada equipo: storage/ está en .gitignore y no viaja por git)
// Son PDFs mínimos escritos a mano (texto en Helvetica, sin dependencias): no son los libros reales.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";

if (process.env.NODE_ENV === "production") {
  console.error("Este script es solo para desarrollo.");
  process.exit(1);
}

const CARPETA = path.join(process.cwd(), "storage", "libros");
const PAGINAS = 6;

// Texto dentro de un string PDF: se escapan \ ( ). Helvetica con WinAnsiEncoding admite tildes y ñ en latin1.
const cadenaPdf = (texto: string) => `(${texto.replace(/[\\()]/g, (c) => `\\${c}`)})`;

function construirPdf(titulo: string, autores: string): Buffer {
  // Objetos: 1 catálogo, 2 árbol de páginas, 3 fuente, y por página: la página y su contenido.
  const objetos: string[] = [];
  const idsPaginas: number[] = [];
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  for (let n = 1; n <= PAGINAS; n++) {
    const idPagina = 2 + n * 2;
    const idContenido = idPagina + 1;
    idsPaginas.push(idPagina);
    const lineas = n === 1
      ? [[26, 720, titulo], [14, 690, autores], [11, 640, "Edición de muestra generada para Biblioteca Next."],
         [11, 622, "Solo se puede leer en línea con un préstamo vigente o una compra (RN-29)."]]
      : [[16, 720, `Capítulo ${n - 1}`],
         ...Array.from({ length: 8 }, (_, i) => [11, 690 - i * 18, `Texto de ejemplo de «${titulo}», página ${n}, línea ${i + 1}.`] as const)];
    const flujo = lineas.map(([tam, y, t]) => `BT /F1 ${tam} Tf 72 ${y} Td ${cadenaPdf(String(t))} Tj ET`)
      .concat(`BT /F1 9 Tf 290 40 Td (${n} / ${PAGINAS}) Tj ET`).join("\n");
    objetos[idPagina] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${idContenido} 0 R >>`;
    objetos[idContenido] = `<< /Length ${Buffer.byteLength(flujo, "latin1")} >>\nstream\n${flujo}\nendstream`;
  }
  objetos[2] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${PAGINAS} >>`;

  // La tabla xref guarda la posición en BYTES de cada objeto: por eso se arma en latin1 y se mide al escribir.
  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    posiciones[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id++) pdf += `${String(posiciones[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// No usa lib/db.ts: ese módulo importa "server-only", que solo funciona dentro de Next.
const conexion = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

try {
  const [ediciones] = await conexion.execute<RowDataPacket[]>(
    `SELECT e.clave_archivo, l.titulo,
            (SELECT GROUP_CONCAT(CONCAT(a.nombre, ' ', a.apellido) SEPARATOR ', ')
             FROM autor_libro la JOIN autor a ON a.id_autor = la.id_autor WHERE la.id_libro = l.id_libro) AS autores
     FROM edicion_digital e JOIN libro l ON l.id_libro = e.id_libro
     WHERE e.formato = 'pdf' ORDER BY l.titulo`,
  );
  await mkdir(CARPETA, { recursive: true });
  for (const e of ediciones) {
    // La clave viene de la BD, pero se valida igual: nunca escribir fuera de la carpeta (path traversal).
    if (!/^[a-z0-9-]+\.pdf$/.test(e.clave_archivo)) {
      console.error(`  ✗ clave no válida, se omite: ${e.clave_archivo}`);
      continue;
    }
    const contenido = construirPdf(e.titulo, e.autores ?? "");
    await writeFile(path.join(CARPETA, e.clave_archivo), contenido);
    console.log(`  ✓ ${e.clave_archivo} (${contenido.length} bytes) — ${e.titulo}`);
  }
  console.log(`${ediciones.length} archivos en ${path.relative(process.cwd(), CARPETA)}/`);
} finally {
  await conexion.end();
}
