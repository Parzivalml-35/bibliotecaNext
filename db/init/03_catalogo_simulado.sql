SET NAMES utf8mb4;

-- =====================================================================
-- bibliotecaNext — catálogo SIMULADO (datos de desarrollo)
-- 96 libros ficticios para probar la paginación y la búsqueda con volumen. A diferencia de 02_seed.sql
-- (libros reales verificados), aquí todo es inventado:
--   * ISBN con prefijo 999: los libros usan 978/979, así que nunca coincide con un libro real.
--   * Autores y editoriales ficticios.
--   * Generado con SQL determinista: cada reconstrucción produce exactamente los mismos datos.
-- Todos los ejemplares quedan `disponible` y ubicados en un estante de su sección (RN-17, RN-20).
-- =====================================================================

INSERT INTO editorial (nombre) VALUES
  ('Ediciones Ficticias del Pacífico'), ('Editorial Imaginaria Andina'), ('Sello Simulado Caribe');

INSERT INTO autor (nombre, apellido, id_pais)
SELECT a.nombre, a.apellido, p.id_pais
FROM (VALUES ROW('Amparo', 'Villalba', 'Colombia'), ROW('Bruno', 'Echeverri', 'Colombia'),
             ROW('Celia', 'Montoya', 'México'), ROW('Darío', 'Quintana', 'Argentina'),
             ROW('Elena', 'Sarmiento', 'Chile'), ROW('Fabián', 'Ortega', 'Perú'),
             ROW('Gloria', 'Uribe', 'Colombia'), ROW('Hernán', 'Lozano', 'Uruguay'),
             ROW('Inés', 'Carvajal', 'México'), ROW('Joaquín', 'Restrepo Mora', 'Colombia'),
             ROW('Karen', 'Salcedo', 'Chile'), ROW('Leonardo', 'Bustamante', 'Argentina'),
             ROW('Mariana', 'Ochoa', 'Perú'), ROW('Nicolás', 'Arango', 'Colombia'),
             ROW('Olga', 'Peñaranda', 'Uruguay'), ROW('Pedro', 'Valencia Ruiz', 'México'),
             ROW('Rosa', 'Mejía Díaz', 'Colombia'), ROW('Samuel', 'Cifuentes', 'Argentina'),
             ROW('Teresa', 'Guzmán', 'Chile'), ROW('Ulises', 'Rendón', 'Colombia'),
             ROW('Verónica', 'Álzate', 'Perú'), ROW('Walter', 'Benítez', 'Uruguay'),
             ROW('Ximena', 'Duarte', 'México'), ROW('Yesid', 'Pardo', 'Colombia')
     ) AS a (nombre, apellido, pais)
JOIN pais p ON p.nombre = a.pais;

-- n = 0..95. Título = parte A (n mod 20) + parte B ((n div 20 + 3·(n mod 20)) mod 16): dado (A, B) se
-- recupera n div 20, así que los 96 títulos son distintos. El ISBN lleva n: 999 + n con 10 dígitos.
INSERT INTO libro (isbn, titulo, anio_publicacion, sinopsis, id_editorial, id_clasificacion, id_genero_principal)
WITH RECURSIVE numero (n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM numero WHERE n < 95),
datos AS (
  SELECT n,
         CONCAT(ELT(1 + n % 20, 'El jardín', 'La casa', 'Los días', 'Las voces', 'El río', 'La ciudad',
                    'El último verano', 'La memoria', 'El viaje', 'Las cartas', 'El silencio', 'La noche',
                    'El faro', 'La sombra', 'El mapa', 'La isla', 'El reloj', 'La lluvia', 'El camino', 'Los nombres'),
                ' ',
                ELT(1 + (FLOOR(n / 20) + 3 * (n % 20)) % 16, 'de las mareas', 'del norte', 'sin regreso', 'de cristal',
                    'de la montaña', 'en el puerto', 'de los abuelos', 'bajo la lluvia', 'de papel', 'del olvido',
                    'al amanecer', 'de la frontera', 'entre los árboles', 'del desierto', 'de sal', 'perdido')) AS titulo,
         ELT(1 + n % 9, 'Novela', 'Cuento', 'Poesía', 'Realismo mágico', 'Romanticismo', 'Crónica', 'Ensayo',
             'Divulgación científica', 'Infantil') AS genero
  FROM numero
)
SELECT CONCAT('999', LPAD(d.n, 10, '0')), d.titulo, 1950 + (d.n * 37) % 73,
       'Obra ficticia generada para probar la paginación y la búsqueda del catálogo.',
       e.id_editorial, c.id_clasificacion, g.id_genero
FROM datos d
JOIN genero g ON g.nombre = d.genero
JOIN editorial e ON e.nombre = ELT(1 + d.n % 3, 'Ediciones Ficticias del Pacífico', 'Editorial Imaginaria Andina',
                                   'Sello Simulado Caribe')
-- RN-46: algunos +15 y +18 para probar la restricción por edad; los infantiles, siempre para todo público.
JOIN clasificacion_edad c ON c.nombre = CASE
       WHEN d.genero = 'Infantil' THEN 'Todo público'
       WHEN d.n % 10 = 0 THEN '+18'
       WHEN d.n % 10 IN (3, 7) THEN '+15'
       ELSE 'Todo público' END;

-- Un autor por libro (24 autores en rotación); uno de cada 11 libros tiene un segundo autor.
INSERT INTO autor_libro (id_autor, id_libro)
WITH simulado AS (
  SELECT id_libro, CAST(SUBSTRING(isbn, 4) AS UNSIGNED) AS n FROM libro WHERE isbn LIKE '999%'
),
-- Los autores ficticios son los que todavía no tienen libros (todos los reales del seed tienen al menos uno).
autor_ficticio AS (
  SELECT a.id_autor, ROW_NUMBER() OVER (ORDER BY a.id_autor) - 1 AS i
  FROM autor a
  WHERE NOT EXISTS (SELECT 1 FROM autor_libro al WHERE al.id_autor = a.id_autor)
)
SELECT af.id_autor, s.id_libro FROM simulado s JOIN autor_ficticio af ON af.i = s.n % 24
UNION ALL
SELECT af.id_autor, s.id_libro FROM simulado s JOIN autor_ficticio af ON af.i = (s.n + 5) % 24
WHERE s.n % 11 = 0;

-- Ejemplares: en cada sede, (n + orden de la sede) mod 3 copias (0, 1 o 2); uno de cada 13 libros no tiene
-- ninguna (para ver "sin ejemplares" en el catálogo). Cada copia va a un estante de la sección de su género
-- principal en esa sede (RN-19), elegido en rotación entre los de esa sección.
INSERT INTO ejemplar (codigo_barras, id_libro, id_sede, id_ubicacion, estado, valor_reposicion, fecha_adquisicion)
WITH simulado AS (
  SELECT l.id_libro, CAST(SUBSTRING(l.isbn, 4) AS UNSIGNED) AS n, g.id_seccion
  FROM libro l JOIN genero g ON g.id_genero = l.id_genero_principal
  WHERE l.isbn LIKE '999%'
),
sede_ordenada AS (SELECT id_sede, ROW_NUMBER() OVER (ORDER BY id_sede) AS orden FROM sede),
estante AS (
  SELECT id_ubicacion, id_sede, id_seccion,
         ROW_NUMBER() OVER (PARTITION BY id_sede, id_seccion ORDER BY pasillo, estante, nivel) AS r,
         COUNT(*) OVER (PARTITION BY id_sede, id_seccion) AS total
  FROM ubicacion
),
copia AS (
  SELECT s.id_libro, s.n, s.id_seccion, so.id_sede, k.k
  FROM simulado s
  CROSS JOIN sede_ordenada so
  JOIN (SELECT 1 AS k UNION ALL SELECT 2) AS k ON k.k <= (s.n + so.orden) % 3
  WHERE s.n % 13 <> 0
)
SELECT CONCAT('BS-', LPAD(ROW_NUMBER() OVER (ORDER BY c.n, c.id_sede, c.k), 4, '0')),
       c.id_libro, c.id_sede, es.id_ubicacion, 'disponible', 30000 + (c.n % 6) * 5000, DATE('2025-06-01')
FROM copia c
JOIN estante es ON es.id_sede = c.id_sede AND es.id_seccion = c.id_seccion AND es.r = (c.n + c.k) % es.total + 1;
