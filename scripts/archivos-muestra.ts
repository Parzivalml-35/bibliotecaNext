// Genera los archivos de muestra en storage/libros/ para las ediciones digitales del seed (RN-29, RN-54): PDF y EPUB.
// Uso: pnpm archivos:muestra   (en cada equipo: storage/ está en .gitignore y no viaja por git)
// Son archivos mínimos escritos a mano (sin dependencias): no son los libros reales.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { crc32 } from "node:zlib";
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

// ---------------------------------------------------------------------
// EPUB (R8, RN-54). Un EPUB es un ZIP con una estructura fija:
//   mimetype                 PRIMERO y sin comprimir: así un programa reconoce el formato leyendo los primeros bytes
//   META-INF/container.xml   dónde está el paquete (.opf)
//   OEBPS/content.opf        metadatos, lista de archivos (manifest) y orden de lectura (spine)
//   OEBPS/nav.xhtml          índice (EPUB 3)
//   OEBPS/*.xhtml, *.css     los capítulos, en XHTML (HTML con reglas de XML)
// ---------------------------------------------------------------------

type EntradaZip = { nombre: string; datos: Buffer };

// ZIP "stored" (método 0, sin comprimir): cada archivo va tal cual, con su CRC32. Formato de PKWARE (APPNOTE.TXT):
// por cada archivo, una cabecera local + los datos; al final, el directorio central (una ficha por archivo con la
// posición de su cabecera local) y el registro de fin (cuántas fichas hay y dónde empieza el directorio).
// Todos los números van en little-endian. La fecha es fija (1-ene-2026 00:00, formato MS-DOS): el archivo sale
// idéntico en cada ejecución. Solo sirve para archivos pequeños (sin ZIP64: menos de 4 GB y 65 535 entradas).
function construirZip(entradas: EntradaZip[]): Buffer {
  const HORA = 0;
  const FECHA = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let posicion = 0;
  for (const { nombre, datos } of entradas) {
    const n = Buffer.from(nombre, "ascii");
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma "PK\3\4"
    local.writeUInt16LE(20, 4); // versión necesaria: 2.0
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // método 0: stored
    local.writeUInt16LE(HORA, 10);
    local.writeUInt16LE(FECHA, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18); // tamaño comprimido = tamaño real (no se comprime)
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    local.writeUInt16LE(0, 28); // sin campo extra (el mimetype debe quedar en el byte 38, sin nada en medio)

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // firma "PK\1\2"
    central.writeUInt16LE(20, 4); // hecho con 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(HORA, 12);
    central.writeUInt16LE(FECHA, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(n.length, 28);
    // 30 extra, 32 comentario, 34 disco, 36 atributos internos, 38 externos: todo 0 (ya lo está por alloc)
    central.writeUInt32LE(posicion, 42); // dónde empieza su cabecera local

    locales.push(local, n, datos);
    centrales.push(central, n);
    posicion += local.length + n.length + datos.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); // firma "PK\5\6"
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(posicion, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

// Texto dentro de XHTML/XML: se escapan los cinco caracteres especiales.
const xml = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

const CAPITULOS = 5;
const PARRAFOS = 14; // de sobra para que cada capítulo ocupe varias páginas en el visor

const xhtml = (titulo: string, cuerpo: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es">
<head><meta charset="UTF-8"/><title>${xml(titulo)}</title><link rel="stylesheet" href="estilo.css"/></head>
<body>
${cuerpo}
</body>
</html>
`;

// RN-84: capítulo TRAMPA, solo en los EPUB con `trampa`. Un EPUB puede traer JavaScript; el visor no debe ejecutarlo
// nunca. Aquí van las tres formas típicas: <script> en línea, un atributo de evento (onerror) y un script externo
// del propio libro. Si CUALQUIERA se ejecutara, cambiaría el texto del párrafo: se comprueba a la vista.
const TEXTO_TRAMPA_OK = "Protegido: ningún script de este libro se ejecutó (RN-84).";
const TEXTO_TRAMPA_MAL = "PELIGRO: un script del libro se ejecutó. La CSP de /leer no está funcionando (RN-84).";
const SCRIPT_TRAMPA = `document.getElementById("estado-trampa").textContent = ${JSON.stringify(TEXTO_TRAMPA_MAL)};`;

function capituloTrampa(): string {
  return xhtml("Prueba de seguridad", `<section epub:type="chapter">
<h1>Prueba de seguridad</h1>
<p>Este capítulo existe solo en el archivo de muestra. Intenta ejecutar JavaScript de tres formas; el visor debe bloquearlas todas.</p>
<p id="estado-trampa" class="trampa">${xml(TEXTO_TRAMPA_OK)}</p>
<script>${SCRIPT_TRAMPA}</script>
<img src="no-existe.png" alt="" onerror="${xml(SCRIPT_TRAMPA)}"/>
<script src="trampa.js"></script>
</section>`);
}

function construirEpub(titulo: string, autores: string, isbn: string, trampa: boolean): Buffer {
  const capitulos = Array.from({ length: CAPITULOS }, (_, i) => {
    const n = i + 1;
    const parrafos = Array.from({ length: PARRAFOS }, (_, j) =>
      `<p>Texto de ejemplo de «${xml(titulo)}», capítulo ${n}, párrafo ${j + 1}. Esta edición de muestra existe para probar el visor: el texto se acomoda al ancho de la pantalla y se reparte en páginas, como en un libro electrónico real.</p>`).join("\n");
    return { id: `cap${n}`, archivo: `cap${n}.xhtml`, titulo: `Capítulo ${n}`,
             contenido: xhtml(`Capítulo ${n}`, `<section epub:type="chapter">\n<h1>Capítulo ${n}</h1>\n${parrafos}\n</section>`) };
  });
  const portada = { id: "portada", archivo: "portada.xhtml", titulo: "Portada",
    contenido: xhtml(titulo, `<section epub:type="titlepage" class="portada">
<h1>${xml(titulo)}</h1>
<p class="autores">${xml(autores)}</p>
<p>Edición de muestra generada para Biblioteca Next.</p>
<p>Solo se puede leer en línea con un préstamo vigente o una compra (RN-29).</p>
</section>`) };
  const secciones = [portada, ...(trampa ? [{ id: "trampa", archivo: "trampa.xhtml", titulo: "Prueba de seguridad", contenido: capituloTrampa() }] : []), ...capitulos];

  const nav = xhtml("Índice", `<nav epub:type="toc" id="toc">
<h1>Índice</h1>
<ol>
${secciones.map((s) => `<li><a href="${s.archivo}">${xml(s.titulo)}</a></li>`).join("\n")}
</ol>
</nav>`);

  // dcterms:modified es obligatorio en EPUB 3; fijo, como la fecha del ZIP.
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id-libro" xml:lang="es">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="id-libro">urn:isbn:${isbn}</dc:identifier>
<dc:title>${xml(titulo)}</dc:title>
<dc:creator>${xml(autores)}</dc:creator>
<dc:language>es</dc:language>
<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="estilo" href="estilo.css" media-type="text/css"/>
${trampa ? `<item id="trampa-js" href="trampa.js" media-type="application/javascript"/>\n` : ""}${secciones.map((s) => `<item id="${s.id}" href="${s.archivo}" media-type="application/xhtml+xml"${s.id === "trampa" ? ` properties="scripted"` : ""}/>`).join("\n")}
</manifest>
<spine>
${secciones.map((s) => `<itemref idref="${s.id}"/>`).join("\n")}
</spine>
</package>
`;

  // Sin colores: el visor pone los del tema activo (DI-06).
  const css = `body { font-family: serif; line-height: 1.6; }
h1 { font-size: 1.6em; margin: 0 0 1em; }
.portada { text-align: center; margin-top: 30%; }
.autores { font-style: italic; }
.trampa { font-weight: bold; border: 2px solid currentColor; padding: 0.5em; }
`;

  const texto = (s: string) => Buffer.from(s, "utf8");
  return construirZip([
    { nombre: "mimetype", datos: texto("application/epub+zip") },
    { nombre: "META-INF/container.xml", datos: texto(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`) },
    { nombre: "OEBPS/content.opf", datos: texto(opf) },
    { nombre: "OEBPS/nav.xhtml", datos: texto(nav) },
    { nombre: "OEBPS/estilo.css", datos: texto(css) },
    ...(trampa ? [{ nombre: "OEBPS/trampa.js", datos: texto(SCRIPT_TRAMPA) }] : []),
    ...secciones.map((s) => ({ nombre: `OEBPS/${s.archivo}`, datos: texto(s.contenido) })),
  ]);
}

// RN-84: qué EPUB de muestra lleva el capítulo trampa (por la clave del archivo).
const CON_TRAMPA = new Set(["maria.epub"]);

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
    `SELECT e.clave_archivo, e.formato, l.titulo, l.isbn,
            (SELECT GROUP_CONCAT(CONCAT(a.nombre, ' ', a.apellido) SEPARATOR ', ')
             FROM autor_libro la JOIN autor a ON a.id_autor = la.id_autor WHERE la.id_libro = l.id_libro) AS autores
     FROM edicion_digital e JOIN libro l ON l.id_libro = e.id_libro
     ORDER BY l.titulo, e.formato`,
  );
  await mkdir(CARPETA, { recursive: true });
  for (const e of ediciones) {
    // La clave viene de la BD, pero se valida igual: nunca escribir fuera de la carpeta (path traversal).
    // La extensión tiene que coincidir con el formato de la fila.
    if (!/^[a-z0-9-]+\.(pdf|epub)$/.test(e.clave_archivo) || !e.clave_archivo.endsWith(`.${e.formato}`)) {
      console.error(`  ✗ clave no válida, se omite: ${e.clave_archivo}`);
      continue;
    }
    const contenido = e.formato === "epub"
      ? construirEpub(e.titulo, e.autores ?? "", e.isbn, CON_TRAMPA.has(e.clave_archivo))
      : construirPdf(e.titulo, e.autores ?? "");
    await writeFile(path.join(CARPETA, e.clave_archivo), contenido);
    console.log(`  ✓ ${e.clave_archivo} (${contenido.length} bytes) — ${e.titulo}`);
  }
  console.log(`${ediciones.length} archivos en ${path.relative(process.cwd(), CARPETA)}/`);
} finally {
  await conexion.end();
}
