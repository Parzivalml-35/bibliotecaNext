-- =====================================================================
-- bibliotecaNext — datos de desarrollo (seed)
-- Libros, autores y editoriales REALES (ISBN de ediciones en español verificados en Open Library, 2026-09-24).
-- Personas y direcciones FICTICIAS; correos en example.com (dominio reservado para ejemplos, RFC 2606).
-- Reglas del seed:
--   * Nunca ids a mano: se buscan por claves naturales (AUTO_INCREMENT no se revierte con ROLLBACK).
--   * Fechas relativas a hoy: cada reconstrucción conserva los escenarios (vencido sigue vencido).
--   * password_hash es un marcador que no corresponde a ninguna contraseña; se reemplaza en la Fase 3.
--   * Las clasificaciones por edad de algunos títulos se asignaron para probar RN-46; no son oficiales.
-- =====================================================================

SET @sin_clave = '!pendiente-fase-3';

-- ---------------------------------------------------------------------
-- Configuración y catálogos
-- ---------------------------------------------------------------------
INSERT INTO configuracion (id, max_renovaciones, multa_por_dia, multa_tope, dias_atraso_perdido,
                           horas_confirmar_reserva_digital, minutos_pago_pedido, dias_devolucion_compra,
                           minimo_sobrante_traslado)
VALUES (1, 2, 1000.00, 30000.00, 30, 48, 30, 15, 1);

INSERT INTO tipo_lector (nombre, max_prestamos_fisicos, dias_prestamo_fisico, max_prestamos_digitales,
                         dias_prestamo_digital, max_reservas_fisicas, max_reservas_digitales, dias_recoger_reserva)
VALUES ('Estándar', 3, 14, 2, 14, 3, 2, 3),
       ('Plus',     5, 21, 4, 21, 5, 4, 5),
       ('Infantil', 2, 14, 1,  7, 2, 1, 3);

INSERT INTO pais (nombre) VALUES
  ('Colombia'), ('Argentina'), ('México'), ('Chile'), ('Perú'), ('Uruguay'), ('Francia'), ('Estados Unidos');

INSERT INTO ciudad (nombre, departamento) VALUES
  ('Cali', 'Valle del Cauca'), ('Palmira', 'Valle del Cauca'), ('Bogotá', 'Bogotá D.C.'), ('Medellín', 'Antioquia');

INSERT INTO clasificacion_edad (nombre, edad_minima) VALUES ('Todo público', 0), ('+15', 15), ('+18', 18);

-- RN-18: secciones y colores de toda la red.
INSERT INTO seccion (nombre, color_hex) VALUES
  ('Literatura', '#1E40AF'),             -- azul
  ('Historia y sociedad', '#B91C1C'),    -- rojo
  ('Ciencia y tecnología', '#047857'),   -- verde
  ('Infantil y juvenil', '#D97706');     -- ámbar

-- RN-19: cada género pertenece a una sección.
INSERT INTO genero (nombre, id_seccion)
SELECT g.nombre, s.id_seccion
FROM (VALUES ROW('Novela', 'Literatura'), ROW('Cuento', 'Literatura'), ROW('Poesía', 'Literatura'),
             ROW('Realismo mágico', 'Literatura'), ROW('Romanticismo', 'Literatura'),
             ROW('Crónica', 'Historia y sociedad'), ROW('Ensayo', 'Historia y sociedad'),
             ROW('Divulgación científica', 'Ciencia y tecnología'),
             ROW('Infantil', 'Infantil y juvenil')) AS g (nombre, seccion)
JOIN seccion s ON s.nombre = g.seccion;

-- Editoriales de las ediciones verificadas (nombres normalizados).
INSERT INTO editorial (nombre) VALUES
  ('Santillana USA'), ('Grupo Editorial Norma'), ('Debolsillo'), ('Mondadori'), ('Alfaguara'), ('Planeta'),
  ('Seix Barral'), ('RBA Editores'), ('Salamandra'), ('Siglo XXI Editores');

INSERT INTO autor (nombre, apellido, id_pais)
SELECT a.nombre, a.apellido, p.id_pais
FROM (VALUES ROW('Gabriel', 'García Márquez', 'Colombia'), ROW('Julio', 'Cortázar', 'Argentina'),
             ROW('Juan', 'Rulfo', 'México'), ROW('Jorge Luis', 'Borges', 'Argentina'),
             ROW('Isabel', 'Allende', 'Chile'), ROW('Mario', 'Vargas Llosa', 'Perú'),
             ROW('Pablo', 'Neruda', 'Chile'), ROW('Ernesto', 'Sábato', 'Argentina'),
             ROW('Jorge', 'Isaacs', 'Colombia'), ROW('Laura', 'Restrepo', 'Colombia'),
             ROW('Antoine de', 'Saint-Exupéry', 'Francia'), ROW('Carl', 'Sagan', 'Estados Unidos'),
             ROW('Eduardo', 'Galeano', 'Uruguay')) AS a (nombre, apellido, pais)
JOIN pais p ON p.nombre = a.pais;

-- Libros (ediciones). anio_publicacion = año de la edición del ISBN.
INSERT INTO libro (isbn, titulo, anio_publicacion, id_editorial, id_clasificacion, id_genero_principal)
SELECT l.isbn, l.titulo, l.anio, e.id_editorial, c.id_clasificacion, g.id_genero
FROM (VALUES
  ROW('9788420471839', 'Cien años de soledad', 2007, 'Santillana USA', 'Todo público', 'Novela'),
  ROW('9789580431770', 'El amor en los tiempos del cólera', 1996, 'Grupo Editorial Norma', 'Todo público', 'Novela'),
  ROW('9789871138012', 'Crónica de una muerte anunciada', 2002, 'Debolsillo', 'Todo público', 'Novela'),
  ROW('9788439701095', 'Noticia de un secuestro', 1996, 'Mondadori', 'Todo público', 'Crónica'),
  ROW('9788420405940', 'Rayuela', 2010, 'Alfaguara', 'Todo público', 'Novela'),
  ROW('9788408045755', 'Pedro Páramo', 2002, 'Planeta', 'Todo público', 'Novela'),
  ROW('9788432204814', 'Ficciones', 1983, 'Seix Barral', 'Todo público', 'Cuento'),
  ROW('9788447306619', 'La casa de los espíritus', 1994, 'RBA Editores', 'Todo público', 'Novela'),
  ROW('9789681903978', 'La ciudad y los perros', 2001, 'Alfaguara', '+15', 'Novela'),
  ROW('9789580469117', 'Veinte poemas de amor y una canción desesperada', 2002, 'Grupo Editorial Norma', 'Todo público', 'Poesía'),
  ROW('9789507310294', 'El túnel', 1991, 'Seix Barral', 'Todo público', 'Novela'),
  ROW('9789580415329', 'María', 2000, 'Grupo Editorial Norma', 'Todo público', 'Novela'),
  ROW('9789505119363', 'Delirio', 2004, 'Alfaguara', '+15', 'Novela'),
  ROW('9788418797453', 'El principito', 2022, 'Salamandra', 'Todo público', 'Infantil'),
  ROW('9788408053040', 'Cosmos', 2004, 'Planeta', 'Todo público', 'Divulgación científica'),
  ROW('9789682325571', 'Las venas abiertas de América Latina', 2006, 'Siglo XXI Editores', 'Todo público', 'Ensayo')
) AS l (isbn, titulo, anio, editorial, clasificacion, genero)
JOIN editorial e ON e.nombre = l.editorial
JOIN clasificacion_edad c ON c.nombre = l.clasificacion
JOIN genero g ON g.nombre = l.genero;

INSERT INTO autor_libro (id_autor, id_libro)
SELECT a.id_autor, l.id_libro
FROM (VALUES
  ROW('García Márquez', '9788420471839'), ROW('García Márquez', '9789580431770'), ROW('García Márquez', '9789871138012'),
  ROW('García Márquez', '9788439701095'), ROW('Cortázar', '9788420405940'), ROW('Rulfo', '9788408045755'),
  ROW('Borges', '9788432204814'), ROW('Allende', '9788447306619'), ROW('Vargas Llosa', '9789681903978'),
  ROW('Neruda', '9789580469117'), ROW('Sábato', '9789507310294'), ROW('Isaacs', '9789580415329'),
  ROW('Restrepo', '9789505119363'), ROW('Saint-Exupéry', '9788418797453'), ROW('Sagan', '9788408053040'),
  ROW('Galeano', '9789682325571')
) AS v (apellido, isbn)
JOIN autor a ON a.apellido = v.apellido
JOIN libro l ON l.isbn = v.isbn;

-- RN-19: géneros secundarios (nunca el principal).
INSERT INTO libro_genero (id_libro, id_genero)
SELECT l.id_libro, g.id_genero
FROM (VALUES ROW('9788420471839', 'Realismo mágico'), ROW('9788447306619', 'Realismo mágico'),
             ROW('9789580415329', 'Romanticismo'), ROW('9788418797453', 'Novela'),
             ROW('9789871138012', 'Crónica')) AS v (isbn, genero)
JOIN libro l ON l.isbn = v.isbn
JOIN genero g ON g.nombre = v.genero;

-- ---------------------------------------------------------------------
-- Sedes y ubicaciones (RN-17, RN-18)
-- ---------------------------------------------------------------------
INSERT INTO sede (nombre, calle, codigo_postal, telefono, horario_apertura, horario_cierre, id_ciudad)
SELECT s.nombre, s.calle, s.cp, s.tel, s.abre, s.cierra, c.id_ciudad
FROM (VALUES ROW('Sede Norte',  'Av. 6N # 23-45', '760045', '602 555 0101', '08:00', '19:00'),
             ROW('Sede Sur',    'Cra. 100 # 16-20', '760033', '602 555 0102', '09:00', '18:00'),
             ROW('Sede Centro', 'Cl. 12 # 5-30', '760044', '602 555 0103', '08:00', '18:00')
     ) AS s (nombre, calle, cp, tel, abre, cierra)
JOIN ciudad c ON c.nombre = 'Cali' AND c.departamento = 'Valle del Cauca';

-- Misma distribución en las tres sedes, generada con un CTE recursivo que produce los números de nivel.
INSERT INTO ubicacion (id_sede, id_seccion, pasillo, estante, nivel)
WITH RECURSIVE nivel (n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM nivel WHERE n < 4)
SELECT s.id_sede, sc.id_seccion, d.pasillo, d.estante, nivel.n
FROM sede s
CROSS JOIN (VALUES ROW('Literatura', 'A', 1, 4), ROW('Literatura', 'A', 2, 4), ROW('Literatura', 'A', 3, 4),
                   ROW('Historia y sociedad', 'B', 1, 4), ROW('Ciencia y tecnología', 'B', 2, 4),
                   ROW('Infantil y juvenil', 'C', 1, 3)) AS d (seccion, pasillo, estante, niveles)
JOIN seccion sc ON sc.nombre = d.seccion
JOIN nivel ON nivel.n <= d.niveles;

SET @norte  = (SELECT id_sede FROM sede WHERE nombre = 'Sede Norte');
SET @sur    = (SELECT id_sede FROM sede WHERE nombre = 'Sede Sur');
SET @centro = (SELECT id_sede FROM sede WHERE nombre = 'Sede Centro');

-- ---------------------------------------------------------------------
-- Cuentas, empleados y lectores (RN-01, RN-31 a RN-34)
-- ---------------------------------------------------------------------
INSERT INTO cuenta (correo, password_hash, fecha_registro, fecha_verificacion) VALUES
  ('laura.castano@example.com',   @sin_clave, NOW() - INTERVAL 400 DAY, NOW() - INTERVAL 400 DAY),
  ('jorge.perez@example.com',     @sin_clave, NOW() - INTERVAL 300 DAY, NOW() - INTERVAL 300 DAY),
  ('marta.torres@example.com',    @sin_clave, NOW() - INTERVAL 300 DAY, NOW() - INTERVAL 300 DAY),
  ('diego.ramirez@example.com',   @sin_clave, NOW() - INTERVAL 200 DAY, NOW() - INTERVAL 200 DAY),
  ('ana.ruiz@example.com',        @sin_clave, NOW() - INTERVAL 120 DAY, NOW() - INTERVAL 120 DAY),
  ('luis.gomez@example.com',      @sin_clave, NOW() - INTERVAL 100 DAY, NOW() - INTERVAL 100 DAY),
  ('valentina.ospina@example.com', @sin_clave, NOW() - INTERVAL 90 DAY, NOW() - INTERVAL 90 DAY),
  ('andres.mejia@example.com',    @sin_clave, NOW() - INTERVAL 80 DAY, NOW() - INTERVAL 80 DAY),
  ('mateo.cardenas@example.com',  @sin_clave, NOW() - INTERVAL 60 DAY, NOW() - INTERVAL 60 DAY),
  ('sofia.herrera@example.com',   @sin_clave, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY),  -- verificada, sin validar
  ('camila.torres@example.com',   @sin_clave, NOW() - INTERVAL 1 DAY, NULL);                        -- sin verificar el correo

INSERT INTO empleado (id_cuenta, nombre, apellido, rol, id_sede, fecha_contratacion)
SELECT c.id_cuenta, e.nombre, e.apellido, e.rol, s.id_sede, e.contratacion
FROM (VALUES ROW('laura.castano@example.com', 'Laura', 'Castaño', 'admin_red', NULL, '2024-08-01'),
             ROW('jorge.perez@example.com', 'Jorge', 'Pérez', 'coordinador', 'Sede Norte', '2024-11-15'),
             ROW('marta.torres@example.com', 'Marta', 'Torres', 'bibliotecario', 'Sede Sur', '2024-11-15'),
             ROW('diego.ramirez@example.com', 'Diego', 'Ramírez', 'bibliotecario', 'Sede Centro', '2025-03-01')
     ) AS e (correo, nombre, apellido, rol, sede, contratacion)
JOIN cuenta c ON c.correo = e.correo
LEFT JOIN sede s ON s.nombre = e.sede;

SET @laura = (SELECT id_empleado FROM empleado JOIN cuenta USING (id_cuenta) WHERE correo = 'laura.castano@example.com');
SET @jorge = (SELECT id_empleado FROM empleado JOIN cuenta USING (id_cuenta) WHERE correo = 'jorge.perez@example.com');
SET @marta = (SELECT id_empleado FROM empleado JOIN cuenta USING (id_cuenta) WHERE correo = 'marta.torres@example.com');
SET @diego = (SELECT id_empleado FROM empleado JOIN cuenta USING (id_cuenta) WHERE correo = 'diego.ramirez@example.com');

-- D-03: validados en mostrador con documento; Sofía y Camila aún no.
INSERT INTO lector (id_cuenta, id_tipo_lector, nombre, apellido, fecha_nacimiento, telefono, calle, codigo_postal,
                    id_ciudad, tipo_documento, numero_documento, fecha_validacion, id_empleado_validador)
SELECT c.id_cuenta, t.id_tipo_lector, l.nombre, l.apellido, l.nacimiento, l.tel, l.calle, l.cp, ci.id_ciudad,
       l.tipo_doc, l.num_doc, IF(l.validador IS NULL, NULL, NOW() - INTERVAL l.dias_validado DAY),
       (SELECT e.id_empleado FROM empleado e JOIN cuenta ce USING (id_cuenta) WHERE ce.correo = l.validador)
FROM (VALUES
  ROW('ana.ruiz@example.com', 'Estándar', 'Ana', 'Ruiz', DATE('1998-03-14'), '300 555 0001', 'Cra. 5 # 10-20', '760001', 'Cali', 'CC', '1000000001', 'jorge.perez@example.com', 115),
  ROW('luis.gomez@example.com', 'Estándar', 'Luis', 'Gómez', DATE('1985-07-02'), '300 555 0002', 'Cl. 8 # 4-15', '760002', 'Cali', 'CC', '1000000002', 'marta.torres@example.com', 95),
  ROW('valentina.ospina@example.com', 'Plus', 'Valentina', 'Ospina', DATE('1992-11-23'), '300 555 0003', 'Cl. 15 # 30-11', '760035', 'Cali', 'CC', '1000000003', 'jorge.perez@example.com', 85),
  ROW('andres.mejia@example.com', 'Estándar', 'Andrés', 'Mejía', DATE('1979-01-30'), '300 555 0004', 'Cra. 44 # 5-60', '760036', 'Cali', 'CC', '1000000004', 'marta.torres@example.com', 75),
  ROW('mateo.cardenas@example.com', 'Infantil', 'Mateo', 'Cárdenas', CURDATE() - INTERVAL 13 YEAR, NULL, 'Cl. 12 # 7-45', '760044', 'Cali', 'TI', '1100000005', 'diego.ramirez@example.com', 55),
  ROW('sofia.herrera@example.com', 'Estándar', 'Sofía', 'Herrera', DATE('2001-06-09'), '300 555 0006', NULL, NULL, 'Palmira', NULL, NULL, NULL, 0),
  ROW('camila.torres@example.com', 'Estándar', 'Camila', 'Torres', DATE('2003-09-17'), NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0)
) AS l (correo, tipo, nombre, apellido, nacimiento, tel, calle, cp, ciudad, tipo_doc, num_doc, validador, dias_validado)
JOIN cuenta c ON c.correo = l.correo
JOIN tipo_lector t ON t.nombre = l.tipo
LEFT JOIN ciudad ci ON ci.nombre = l.ciudad;

SET @ana       = (SELECT id_lector FROM lector JOIN cuenta USING (id_cuenta) WHERE correo = 'ana.ruiz@example.com');
SET @luis      = (SELECT id_lector FROM lector JOIN cuenta USING (id_cuenta) WHERE correo = 'luis.gomez@example.com');
SET @valentina = (SELECT id_lector FROM lector JOIN cuenta USING (id_cuenta) WHERE correo = 'valentina.ospina@example.com');
SET @andres    = (SELECT id_lector FROM lector JOIN cuenta USING (id_cuenta) WHERE correo = 'andres.mejia@example.com');
SET @mateo     = (SELECT id_lector FROM lector JOIN cuenta USING (id_cuenta) WHERE correo = 'mateo.cardenas@example.com');

-- ---------------------------------------------------------------------
-- Ejemplares (RN-20, RN-22, RN-23). El estado guardado debe coincidir con préstamos y reservas de abajo.
-- ---------------------------------------------------------------------
INSERT INTO ejemplar (codigo_barras, id_libro, id_sede, id_ubicacion, estado, valor_reposicion, fecha_adquisicion)
SELECT v.codigo, l.id_libro, s.id_sede, u.id_ubicacion, v.estado, v.valor, v.adquirido
FROM (VALUES
  ROW('BN-0001', '9788420471839', 'Sede Norte',  'A', 1, 1, 'prestado',      65000, DATE('2025-02-10')),  -- Ana, al día
  ROW('BN-0002', '9788420471839', 'Sede Norte',  'A', 1, 1, 'disponible',    65000, DATE('2025-02-10')),
  ROW('BN-0003', '9788420471839', 'Sede Norte',  'A', 1, 1, 'disponible',    65000, DATE('2025-02-10')),  -- en traslado pendiente a Centro
  ROW('BN-0004', '9788420471839', 'Sede Sur',    'A', 1, 1, 'disponible',    65000, DATE('2025-02-10')),
  ROW('BN-0005', '9789580431770', 'Sede Norte',  'A', 1, 2, 'disponible',    58000, DATE('2025-02-10')),
  ROW('BN-0006', '9789580431770', 'Sede Centro', 'A', 1, 1, 'disponible',    58000, DATE('2025-03-05')),
  ROW('BN-0007', '9789871138012', 'Sede Sur',    'A', 1, 2, 'prestado',      42000, DATE('2025-02-10')),  -- Luis, vencido
  ROW('BN-0008', '9789871138012', 'Sede Norte',  'A', 1, 2, 'disponible',    42000, DATE('2025-02-10')),
  ROW('BN-0009', '9788439701095', 'Sede Norte',  'B', 1, 1, 'disponible',    55000, DATE('2025-02-10')),
  ROW('BN-0010', '9788439701095', 'Sede Sur',    'B', 1, 1, 'disponible',    55000, DATE('2025-02-10')),
  ROW('BN-0011', '9788420405940', 'Sede Norte',  'A', 2, 1, 'disponible',    59000, DATE('2025-02-10')),
  ROW('BN-0012', '9788420405940', 'Sede Sur',    NULL, NULL, NULL, 'por_ubicar', 59000, DATE('2025-02-10')), -- RN-13/RN-20: era de Norte, devuelto en Sur
  ROW('BN-0013', '9788408045755', 'Sede Centro', 'A', 1, 2, 'apartado',      39000, DATE('2025-03-05')),  -- reserva asignada de Ana
  ROW('BN-0014', '9788408045755', 'Sede Centro', 'A', 1, 2, 'disponible',    39000, DATE('2025-03-05')),
  ROW('BN-0015', '9788432204814', 'Sede Norte',  'A', 2, 2, 'disponible',    47000, DATE('2025-02-10')),  -- auditoría: hallado en A-2-3
  ROW('BN-0016', '9788432204814', 'Sede Centro', NULL, NULL, NULL, 'en_reparacion', 47000, DATE('2025-03-05')),
  ROW('BN-0017', '9788447306619', 'Sede Norte',  'A', 2, 3, 'disponible',    61000, DATE('2025-02-10')),
  ROW('BN-0018', '9788447306619', 'Sede Sur',    'A', 2, 1, 'prestado',      61000, DATE('2025-02-10')),  -- Valentina; cola en Sur
  ROW('BN-0019', '9789681903978', 'Sede Norte',  'A', 3, 1, 'disponible',    52000, DATE('2025-02-10')),
  ROW('BN-0020', '9789580469117', 'Sede Norte',  'A', 3, 2, 'disponible',    32000, DATE('2025-02-10')),
  ROW('BN-0021', '9789580469117', 'Sede Sur',    'A', 2, 2, 'disponible',    32000, DATE('2025-02-10')),
  ROW('BN-0022', '9789507310294', 'Sede Sur',    'A', 2, 3, 'disponible',    38000, DATE('2025-02-10')),  -- devuelto tarde por Andrés (RN-47)
  ROW('BN-0023', '9789580415329', 'Sede Norte',  'A', 3, 3, 'disponible',    30000, DATE('2025-02-10')),
  ROW('BN-0024', '9789580415329', 'Sede Centro', 'A', 2, 1, 'disponible',    30000, DATE('2025-03-05')),
  ROW('BN-0025', '9789505119363', 'Sede Centro', 'A', 2, 2, 'disponible',    54000, DATE('2025-03-05')),
  ROW('BN-0026', '9788418797453', 'Sede Norte',  'C', 1, 1, 'disponible',    35000, DATE('2025-02-10')),
  ROW('BN-0027', '9788418797453', 'Sede Sur',    'C', 1, 1, 'disponible',    35000, DATE('2025-02-10')),
  ROW('BN-0028', '9788418797453', 'Sede Centro', 'C', 1, 1, 'disponible',    35000, DATE('2025-03-05')),
  ROW('BN-0029', '9788408053040', 'Sede Norte',  'B', 2, 1, 'disponible',    72000, DATE('2025-02-10')),
  ROW('BN-0030', '9788408053040', 'Sede Centro', 'B', 2, 1, 'disponible',    72000, DATE('2025-03-05')),
  ROW('BN-0031', '9789682325571', 'Sede Sur',    'B', 1, 2, 'disponible',    48000, DATE('2025-02-10')),
  ROW('BN-0032', '9789682325571', 'Sede Centro', 'B', 1, 1, 'disponible',    48000, DATE('2025-03-05'))
) AS v (codigo, isbn, sede, pasillo, estante, nivel, estado, valor, adquirido)
JOIN libro l ON l.isbn = v.isbn
JOIN sede s ON s.nombre = v.sede
LEFT JOIN ubicacion u ON u.id_sede = s.id_sede AND u.pasillo = v.pasillo AND u.estante = v.estante AND u.nivel = v.nivel;

-- ---------------------------------------------------------------------
-- Préstamos físicos y multas (RN-02 a RN-05, RN-13)
-- ---------------------------------------------------------------------
INSERT INTO prestamo_fisico (id_ejemplar, id_lector, id_sede_prestamo, id_empleado_presta, fecha_prestamo,
                             fecha_vencimiento, fecha_devolucion, id_sede_devolucion, id_empleado_recibe)
SELECT e.id_ejemplar, p.lector, p.sede, p.presta, NOW() - INTERVAL p.hace DAY,
       DATE(NOW() - INTERVAL p.hace DAY) + INTERVAL 14 DAY,
       IF(p.devuelto_hace IS NULL, NULL, NOW() - INTERVAL p.devuelto_hace DAY), p.sede_dev, p.recibe
FROM (VALUES
  ROW('BN-0001', @ana,       @norte, @jorge,  5, NULL, NULL,  NULL),    -- activo, al día
  ROW('BN-0007', @luis,      @sur,   @marta, 30, NULL, NULL,  NULL),    -- vencido hace 16 días → Luis bloqueado (RN-03)
  ROW('BN-0018', @valentina, @sur,   @marta,  3, NULL, NULL,  NULL),    -- activo; genera la cola de Sur
  ROW('BN-0012', @valentina, @norte, @jorge, 20,    8, @sur,  @marta),  -- devuelto a tiempo en OTRA sede (RN-13)
  ROW('BN-0022', @andres,    @sur,   @marta, 40,   21, @sur,  @marta)   -- devuelto 5 días tarde → multa
) AS p (codigo, lector, sede, presta, hace, devuelto_hace, sede_dev, recibe)
JOIN ejemplar e ON e.codigo_barras = p.codigo;

-- RN-05: 5 días × $1.000, pendiente → Andrés bloqueado (RN-03).
INSERT INTO multa (id_prestamo, tipo, monto, fecha_generada)
SELECT pf.id_prestamo, 'retraso', 5 * cf.multa_por_dia, pf.fecha_devolucion
FROM prestamo_fisico pf JOIN ejemplar e USING (id_ejemplar) CROSS JOIN configuracion cf
WHERE e.codigo_barras = 'BN-0022';

-- ---------------------------------------------------------------------
-- Reservas físicas (RN-07 a RN-12)
-- ---------------------------------------------------------------------
INSERT INTO reserva_fisica (id_lector, id_libro, id_sede, estado, fecha_solicitud, id_ejemplar,
                            fecha_asignacion, fecha_limite_recogida)
SELECT r.lector, l.id_libro, r.sede, r.estado, NOW() - INTERVAL r.hace_horas HOUR, e.id_ejemplar,
       IF(r.estado = 'asignada', NOW() - INTERVAL 20 HOUR, NULL),
       IF(r.estado = 'asignada', NOW() + INTERVAL 52 HOUR, NULL)
FROM (VALUES
  ROW(@ana,   '9788408045755', @centro, 'asignada', 30, 'BN-0013'),  -- lista para recoger en Centro
  ROW(@ana,   '9788447306619', @sur,    'activa',   48, NULL),       -- 1.º en la cola de Sur
  ROW(@mateo, '9788447306619', @sur,    'activa',   20, NULL),       -- 2.º en la cola de Sur
  ROW(@mateo, '9788420471839', @centro, 'activa',   26, NULL)        -- Centro no tiene copias → traslado sugerido
) AS r (lector, isbn, sede, estado, hace_horas, codigo)
JOIN libro l ON l.isbn = r.isbn
LEFT JOIN ejemplar e ON e.codigo_barras = r.codigo;

-- ---------------------------------------------------------------------
-- Traslado confirmado, aún sin despachar (RN-14, RN-15, RN-51)
-- ---------------------------------------------------------------------
INSERT INTO traslado (id_sede_origen, id_sede_destino, id_empleado_confirma, fecha_confirmacion)
VALUES (@norte, @centro, @jorge, NOW() - INTERVAL 3 HOUR);
INSERT INTO traslado_ejemplar (id_traslado, id_ejemplar)
SELECT LAST_INSERT_ID(), id_ejemplar FROM ejemplar WHERE codigo_barras = 'BN-0003';

-- ---------------------------------------------------------------------
-- Auditoría cerrada con un libro mal ubicado pendiente de decisión (RN-53)
-- ---------------------------------------------------------------------
INSERT INTO auditoria_estante (id_sede, pasillo, estante, id_empleado, fecha_inicio, fecha_cierre)
VALUES (@norte, 'A', 2, @jorge, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY + INTERVAL 25 MINUTE);
SET @auditoria = LAST_INSERT_ID();

INSERT INTO auditoria_lectura (id_auditoria, codigo_barras, id_ejemplar, id_ubicacion, fecha_lectura)
SELECT @auditoria, v.codigo, e.id_ejemplar, u.id_ubicacion, NOW() - INTERVAL 2 DAY + INTERVAL v.minuto MINUTE
FROM (VALUES ROW('BN-0011', 1, 5), ROW('BN-0015', 3, 9), ROW('BN-0017', 3, 12)) AS v (codigo, nivel, minuto)
JOIN ejemplar e ON e.codigo_barras = v.codigo
JOIN ubicacion u ON u.id_sede = @norte AND u.pasillo = 'A' AND u.estante = 2 AND u.nivel = v.nivel;

INSERT INTO auditoria_hallazgo (id_auditoria, tipo, codigo_barras, id_ejemplar, id_ubicacion_esperada, id_ubicacion_encontrada)
SELECT @auditoria, 'mal_ubicado', e.codigo_barras, e.id_ejemplar, e.id_ubicacion, al.id_ubicacion
FROM ejemplar e JOIN auditoria_lectura al ON al.id_ejemplar = e.id_ejemplar AND al.id_auditoria = @auditoria
WHERE e.codigo_barras = 'BN-0015';

-- ---------------------------------------------------------------------
-- Digital (RN-25 a RN-30, RN-54 a RN-56). Los archivos no están en el repo: clave_archivo es un marcador.
-- María (1867) es de dominio público: candidata a archivo de muestra real.
-- ---------------------------------------------------------------------
INSERT INTO edicion_digital (id_libro, formato, clave_archivo, tamano_bytes)
SELECT l.id_libro, 'pdf', v.clave, v.tamano
FROM (VALUES ROW('9788420471839', 'cien-anos-de-soledad.pdf', 2400000), ROW('9788418797453', 'el-principito.pdf', 900000),
             ROW('9788408053040', 'cosmos.pdf', 5200000), ROW('9789580415329', 'maria.pdf', 1100000)) AS v (isbn, clave, tamano)
JOIN libro l ON l.isbn = v.isbn;

INSERT INTO licencia_digital (id_libro, cantidad, fecha_adquisicion, fecha_vencimiento, id_empleado_registra)
SELECT l.id_libro, v.cantidad, v.adquirida, v.vence, @laura
FROM (VALUES ROW('9788420471839', 2, DATE('2026-01-15'), DATE('2026-12-31')),   -- dos lotes del mismo título (RN-55)
             ROW('9788420471839', 1, DATE('2026-06-01'), NULL),
             ROW('9788418797453', 1, DATE('2026-02-01'), NULL),                  -- una sola licencia: agotada
             ROW('9788408053040', 3, DATE('2026-02-01'), DATE('2027-06-30')),
             ROW('9789580415329', 5, DATE('2026-02-01'), NULL)) AS v (isbn, cantidad, adquirida, vence)
JOIN libro l ON l.isbn = v.isbn;

-- Préstamos digitales: la licencia única de El principito está en uso → Mateo en cola.
INSERT INTO prestamo_digital (id_lector, id_licencia, fecha_inicio, fecha_fin)
SELECT v.lector, lic.id_licencia, NOW() - INTERVAL v.hace DAY, NOW() - INTERVAL v.hace DAY + INTERVAL v.dias DAY
FROM (VALUES ROW(@ana, '9788418797453', NULL, 2, 14),
             ROW(@valentina, '9788420471839', DATE('2026-12-31'), 1, 21)) AS v (lector, isbn, vence, hace, dias)
JOIN libro l ON l.isbn = v.isbn
JOIN licencia_digital lic ON lic.id_libro = l.id_libro AND lic.fecha_vencimiento <=> v.vence;

INSERT INTO reserva_digital (id_lector, id_libro, fecha_solicitud)
SELECT @mateo, id_libro, NOW() - INTERVAL 1 DAY FROM libro WHERE isbn = '9788418797453';

-- ---------------------------------------------------------------------
-- Compras (RN-36 a RN-42, RN-57 a RN-61)
-- ---------------------------------------------------------------------
INSERT INTO producto (id_libro, tipo, precio)
SELECT l.id_libro, v.tipo, v.precio
FROM (VALUES ROW('9788420471839', 'fisico', 65000), ROW('9788420405940', 'fisico', 59000),
             ROW('9788418797453', 'fisico', 35000), ROW('9788408053040', 'fisico', 72000),
             ROW('9789580469117', 'fisico', 32000),
             ROW('9788420471839', 'digital', 30000), ROW('9788408053040', 'digital', 28000),
             ROW('9788418797453', 'digital', 15000)) AS v (isbn, tipo, precio)
JOIN libro l ON l.isbn = v.isbn;

-- Stock ya descontado por los pedidos de abajo (el pendiente de Mateo tiene 1 apartado, RN-37).
INSERT INTO stock_venta (id_producto, id_sede, cantidad)
SELECT p.id_producto, s.id_sede, v.cantidad
FROM (VALUES ROW('9788420471839', 'Sede Norte', 3), ROW('9788420471839', 'Sede Sur', 2),
             ROW('9788420405940', 'Sede Norte', 2), ROW('9788420405940', 'Sede Sur', 1),
             ROW('9788418797453', 'Sede Norte', 5), ROW('9788418797453', 'Sede Sur', 3), ROW('9788418797453', 'Sede Centro', 3),
             ROW('9788408053040', 'Sede Centro', 2), ROW('9789580469117', 'Sede Norte', 2)) AS v (isbn, sede, cantidad)
JOIN libro l ON l.isbn = v.isbn
JOIN producto p ON p.id_libro = l.id_libro AND p.tipo = 'fisico'
JOIN sede s ON s.nombre = v.sede;

INSERT INTO tarifa_envio (id_ciudad, valor, monto_envio_gratis)
SELECT c.id_ciudad, v.valor, v.gratis
FROM (VALUES ROW('Cali', 8000, 150000), ROW('Palmira', 10000, NULL), ROW('Bogotá', 15000, NULL),
             ROW('Medellín', 15000, NULL)) AS v (ciudad, valor, gratis)
JOIN ciudad c ON c.nombre = v.ciudad;

-- RN-57: Sofía (verificada, sin validar) puede comprar; tiene un carrito sin confirmar (no aparta stock).
INSERT INTO carrito_item (id_lector, id_producto, cantidad)
SELECT lc.id_lector, p.id_producto, 1
FROM lector lc JOIN cuenta c USING (id_cuenta)
JOIN libro l ON l.isbn = '9788420405940'
JOIN producto p ON p.id_libro = l.id_libro AND p.tipo = 'fisico'
WHERE c.correo = 'sofia.herrera@example.com';

-- Pedidos: uno por modalidad y estado relevante. Dirección y costo de envío congelados (RN-58).
INSERT INTO pedido (id_lector, modalidad, estado, id_sede, envio_destinatario, envio_telefono, envio_calle,
                    envio_codigo_postal, envio_id_ciudad, costo_envio, numero_guia, fecha_creacion,
                    fecha_limite_pago, fecha_pago, fecha_entrega, id_empleado_entrega)
SELECT v.lector, v.modalidad, v.estado, v.sede, v.dest, v.tel, v.calle, v.cp, c.id_ciudad, v.costo, v.guia,
       NOW() - INTERVAL v.creado_min MINUTE,
       NOW() - INTERVAL v.creado_min MINUTE + INTERVAL cf.minutos_pago_pedido MINUTE,
       IF(v.pagado_min IS NULL, NULL, NOW() - INTERVAL v.pagado_min MINUTE),
       IF(v.entregado_min IS NULL, NULL, NOW() - INTERVAL v.entregado_min MINUTE),
       v.entrega
FROM (VALUES
  -- Ana recoge en Norte: entregado.
  ROW(@ana, 'recoger', 'entregado', @norte, NULL, NULL, NULL, NULL, NULL, 0, NULL, 14400, 14390, 12960, @jorge),
  -- Luis (bloqueado para préstamos, pero puede comprar: RN-43) pide envío a Bogotá desde Norte: enviado.
  ROW(@luis, 'envio', 'enviado', @norte, 'Luis Gómez', '300 555 0002', 'Cra. 7 # 45-10', '110231', 'Bogotá', 15000, 'GU-2026-000123', 4320, 4300, NULL, NULL),
  -- Valentina compra un ebook: se entrega al pagar.
  ROW(@valentina, 'solo_digital', 'entregado', NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 7200, 7195, 7195, NULL),
  -- Mateo recoge en Centro: pendiente de pago (stock apartado, vence en 20 minutos).
  ROW(@mateo, 'recoger', 'pendiente_pago', @centro, NULL, NULL, NULL, NULL, NULL, 0, NULL, 10, NULL, NULL, NULL),
  -- Andrés no pagó a tiempo: vencido (RN-37, RN-48); su stock ya se devolvió.
  ROW(@andres, 'recoger', 'vencido', @sur, NULL, NULL, NULL, NULL, NULL, 0, NULL, 180, NULL, NULL, NULL)
) AS v (lector, modalidad, estado, sede, dest, tel, calle, cp, ciudad, costo, guia, creado_min, pagado_min, entregado_min, entrega)
CROSS JOIN configuracion cf
LEFT JOIN ciudad c ON c.nombre = v.ciudad;

-- Detalle con el precio del momento (RN-39): se copia del producto al crear el pedido.
INSERT INTO pedido_detalle (id_pedido, id_producto, cantidad, precio_unitario)
SELECT pe.id_pedido, p.id_producto, 1, p.precio
FROM (VALUES ROW('ana.ruiz@example.com', 'entregado', '9789580469117', 'fisico'),
             ROW('luis.gomez@example.com', 'enviado', '9788420471839', 'fisico'),
             ROW('valentina.ospina@example.com', 'entregado', '9788408053040', 'digital'),
             ROW('mateo.cardenas@example.com', 'pendiente_pago', '9788418797453', 'fisico'),
             ROW('andres.mejia@example.com', 'vencido', '9788420405940', 'fisico')) AS v (correo, estado, isbn, tipo)
JOIN cuenta c ON c.correo = v.correo
JOIN lector lc ON lc.id_cuenta = c.id_cuenta
JOIN pedido pe ON pe.id_lector = lc.id_lector AND pe.estado = v.estado
JOIN libro l ON l.isbn = v.isbn
JOIN producto p ON p.id_libro = l.id_libro AND p.tipo = v.tipo;

-- Pagos (RN-59): Luis tuvo un intento fallido antes del exitoso. Monto = total calculado del pedido.
INSERT INTO pago (id_pedido, monto, estado, fecha_creacion, fecha_confirmacion)
SELECT pe.id_pedido, t.total, v.estado, pe.fecha_pago - INTERVAL v.antes MINUTE, pe.fecha_pago - INTERVAL v.antes MINUTE
FROM pedido pe
JOIN (SELECT id_pedido, SUM(cantidad * precio_unitario) + MAX(pe2.costo_envio) AS total
      FROM pedido_detalle JOIN pedido pe2 USING (id_pedido) GROUP BY id_pedido) AS t USING (id_pedido)
JOIN (VALUES ROW('entregado', 'pagado', 0), ROW('enviado', 'fallido', 5), ROW('enviado', 'pagado', 0)) AS v (estado_pedido, estado, antes)
  ON v.estado_pedido = pe.estado;

-- RN-61: el ebook pagado da acceso permanente; Valentina ya lo abrió (no reembolsable, RN-41).
INSERT INTO acceso_digital (id_lector, id_libro, id_pedido, fecha_otorgado, fecha_primera_lectura)
SELECT pe.id_lector, p.id_libro, pe.id_pedido, pe.fecha_pago, pe.fecha_pago + INTERVAL 30 MINUTE
FROM pedido pe
JOIN pedido_detalle d USING (id_pedido)
JOIN producto p ON p.id_producto = d.id_producto AND p.tipo = 'digital'
WHERE pe.estado = 'entregado';
