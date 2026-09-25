-- =====================================================================
-- bibliotecaNext — consultas clave (NO se ejecutan al iniciar: están fuera de db/init/)
-- Ejecutar a mano sobre la BD con el seed cargado. Los parámetros van como variables @...;
-- en la app (lib/data) cada @variable se convierte en un placeholder ? de mysql2.
-- =====================================================================

SET NAMES utf8mb4;   -- el cliente mysql del contenedor usa latin1 por defecto: ver db/init/01_schema.sql

SET @texto  = 'soledad';              -- búsqueda del catálogo
SET @isbn   = '9788420471839';        -- Cien años de soledad
SET @correo = 'luis.gomez@example.com';

-- ---------------------------------------------------------------------
-- 1. Catálogo: búsqueda por título o autor, con disponibilidad total (Fase 2, /catalogo)
-- ---------------------------------------------------------------------
SELECT l.id_libro, l.titulo,
       GROUP_CONCAT(DISTINCT CONCAT(a.nombre, ' ', a.apellido) SEPARATOR ', ') AS autores,
       g.nombre AS genero, sc.nombre AS seccion, sc.color_hex,
       (SELECT COUNT(*) FROM ejemplar e WHERE e.id_libro = l.id_libro AND e.estado = 'disponible') AS disponibles
FROM libro l
JOIN autor_libro al USING (id_libro) JOIN autor a USING (id_autor)
JOIN genero g ON g.id_genero = l.id_genero_principal JOIN seccion sc ON sc.id_seccion = g.id_seccion
WHERE l.titulo LIKE CONCAT('%', @texto, '%')
   OR CONCAT(a.nombre, ' ', a.apellido) LIKE CONCAT('%', @texto, '%')
GROUP BY l.id_libro
ORDER BY l.titulo;

-- ---------------------------------------------------------------------
-- 2. RN-08: disponibilidad por sede de una obra (Fase 2, /libros/[id])
-- ---------------------------------------------------------------------
SELECT sd.nombre AS sede,
       COALESCE(SUM(e.estado = 'disponible'), 0) AS disponibles,   -- SUM de 0 filas es NULL, no 0
       COUNT(e.id_ejemplar) AS total
FROM sede sd
LEFT JOIN ejemplar e ON e.id_sede = sd.id_sede AND e.id_libro = (SELECT id_libro FROM libro WHERE isbn = @isbn)
GROUP BY sd.id_sede
ORDER BY sd.nombre;

-- ---------------------------------------------------------------------
-- 3. RN-17: "¿dónde está el libro?" — ubicación de las copias disponibles
-- ---------------------------------------------------------------------
SELECT sd.nombre AS sede, sc.nombre AS seccion, sc.color_hex,
       CONCAT('Pasillo ', u.pasillo, ' – Estante ', u.estante, ', nivel ', u.nivel) AS ubicacion,
       COUNT(*) AS copias
FROM ejemplar e
JOIN libro l USING (id_libro) JOIN sede sd USING (id_sede)
JOIN ubicacion u ON u.id_ubicacion = e.id_ubicacion JOIN seccion sc ON sc.id_seccion = u.id_seccion
WHERE l.isbn = @isbn AND e.estado = 'disponible'
GROUP BY sd.id_sede, u.id_ubicacion
ORDER BY sd.nombre;

-- ---------------------------------------------------------------------
-- 4. RN-01, RN-03, RN-46: estado deducido de un lector (nada de esto se guarda)
-- ---------------------------------------------------------------------
SELECT lc.id_lector, CONCAT(lc.nombre, ' ', lc.apellido) AS lector,
       TIMESTAMPDIFF(YEAR, lc.fecha_nacimiento, CURDATE()) AS edad,
       CASE WHEN c.fecha_desactivacion IS NOT NULL THEN 'desactivada'
            WHEN lc.fecha_validacion IS NOT NULL THEN 'validada'
            WHEN c.fecha_verificacion IS NOT NULL THEN 'verificada'
            ELSE 'registrada' END AS estado_cuenta,
       EXISTS (SELECT 1 FROM multa m JOIN prestamo_fisico p USING (id_prestamo)
               WHERE p.id_lector = lc.id_lector AND m.estado = 'pendiente') AS tiene_multa_pendiente,
       EXISTS (SELECT 1 FROM prestamo_fisico p
               WHERE p.id_lector = lc.id_lector AND p.fecha_devolucion IS NULL AND p.fecha_vencimiento < CURDATE()) AS tiene_prestamo_vencido,
       -- RN-02: préstamos físicos abiertos frente al máximo del tipo de lector
       (SELECT COUNT(*) FROM prestamo_fisico p WHERE p.id_lector = lc.id_lector AND p.fecha_devolucion IS NULL) AS prestamos_abiertos,
       t.max_prestamos_fisicos
FROM lector lc JOIN cuenta c USING (id_cuenta) JOIN tipo_lector t USING (id_tipo_lector)
WHERE c.correo = @correo;

-- ---------------------------------------------------------------------
-- 5. Consulta de ejemplo del taller de BD2: préstamos activos con título, lector y fecha esperada
-- ---------------------------------------------------------------------
SELECT l.titulo, CONCAT(lc.nombre, ' ', lc.apellido) AS lector, sd.nombre AS sede,
       p.fecha_vencimiento,
       IF(p.fecha_vencimiento < CURDATE(), CONCAT('vencido hace ', DATEDIFF(CURDATE(), p.fecha_vencimiento), ' días'), 'al día') AS estado
FROM prestamo_fisico p
JOIN ejemplar e USING (id_ejemplar) JOIN libro l USING (id_libro)
JOIN lector lc USING (id_lector) JOIN sede sd ON sd.id_sede = p.id_sede_prestamo
WHERE p.fecha_devolucion IS NULL
ORDER BY p.fecha_vencimiento;

-- ---------------------------------------------------------------------
-- 6. RN-09, RN-11: cola de reservas físicas con posición calculada
-- ---------------------------------------------------------------------
SELECT l.titulo, sd.nombre AS sede, CONCAT(lc.nombre, ' ', lc.apellido) AS lector, r.estado,
       ROW_NUMBER() OVER (PARTITION BY r.id_libro, r.id_sede ORDER BY r.fecha_solicitud, r.id_reserva) AS posicion
FROM reserva_fisica r
JOIN libro l USING (id_libro) JOIN sede sd USING (id_sede) JOIN lector lc USING (id_lector)
WHERE r.estado IN ('activa', 'asignada')
ORDER BY l.titulo, sd.nombre, posicion;

-- ---------------------------------------------------------------------
-- 7. RN-14: traslados sugeridos (calculado): sedes con cola y sin copias vs. sedes con sobrante
-- ---------------------------------------------------------------------
WITH disponibles AS (
  SELECT id_libro, id_sede, COUNT(*) AS n FROM ejemplar WHERE estado = 'disponible' GROUP BY id_libro, id_sede
), demanda AS (
  SELECT id_libro, id_sede, COUNT(*) AS en_cola FROM reserva_fisica WHERE estado = 'activa' GROUP BY id_libro, id_sede
)
SELECT l.titulo, so.nombre AS desde, sd.nombre AS hacia, d.en_cola, o.n AS disponibles_en_origen,
       LEAST(d.en_cola, o.n - cf.minimo_sobrante_traslado) AS sugeridos
FROM demanda d
JOIN libro l USING (id_libro)
JOIN sede sd ON sd.id_sede = d.id_sede
CROSS JOIN configuracion cf
JOIN disponibles o ON o.id_libro = d.id_libro AND o.id_sede <> d.id_sede AND o.n > cf.minimo_sobrante_traslado
JOIN sede so ON so.id_sede = o.id_sede
WHERE NOT EXISTS (SELECT 1 FROM disponibles x WHERE x.id_libro = d.id_libro AND x.id_sede = d.id_sede)
ORDER BY l.titulo, o.n DESC;

-- ---------------------------------------------------------------------
-- 8. RN-49: préstamos candidatos a declarar perdidos (lista calculada; decide un empleado)
-- ---------------------------------------------------------------------
SELECT e.codigo_barras, l.titulo, CONCAT(lc.nombre, ' ', lc.apellido) AS lector,
       DATEDIFF(CURDATE(), p.fecha_vencimiento) AS dias_atraso, e.valor_reposicion
FROM prestamo_fisico p
JOIN ejemplar e USING (id_ejemplar) JOIN libro l USING (id_libro) JOIN lector lc USING (id_lector)
CROSS JOIN configuracion cf
WHERE p.fecha_devolucion IS NULL AND DATEDIFF(CURDATE(), p.fecha_vencimiento) > cf.dias_atraso_perdido;

-- ---------------------------------------------------------------------
-- 9. RN-55, RN-56: lotes de licencias de un título, en uso, libres y cuál se asignaría
--    (en la app: dentro de una transacción, con SELECT ... FOR UPDATE sobre los lotes del título)
-- ---------------------------------------------------------------------
SET @dias = 14;   -- dias_prestamo_digital del tipo de lector
SELECT lic.id_licencia, lic.cantidad, lic.fecha_vencimiento,
       (SELECT COUNT(*) FROM prestamo_digital p
         WHERE p.id_licencia = lic.id_licencia AND p.fecha_devolucion IS NULL AND p.fecha_fin > NOW())
     + (SELECT COUNT(*) FROM reserva_digital r
         WHERE r.id_licencia = lic.id_licencia AND r.estado = 'asignada' AND r.fecha_limite_confirmacion > NOW()) AS en_uso,
       (lic.fecha_vencimiento IS NULL OR lic.fecha_vencimiento >= DATE(NOW() + INTERVAL @dias DAY)) AS cubre_plazo,
       CAST(LEAST(NOW() + INTERVAL @dias DAY, COALESCE(TIMESTAMP(lic.fecha_vencimiento, '23:59:59'), '9999-12-31')) AS DATETIME) AS fin_si_se_presta
FROM licencia_digital lic JOIN libro l USING (id_libro)
WHERE l.isbn = @isbn AND (lic.fecha_vencimiento IS NULL OR lic.fecha_vencimiento >= CURDATE())
HAVING en_uso < lic.cantidad
-- RN-55: primero los que cubren el plazo, y de ellos el que vence antes; si ninguno cubre, el que vence más tarde.
ORDER BY cubre_plazo DESC,
         CASE WHEN cubre_plazo THEN COALESCE(lic.fecha_vencimiento, '9999-12-31') END ASC,
         lic.fecha_vencimiento DESC;

-- ---------------------------------------------------------------------
-- 10. RN-58: pedidos con total calculado (no se guarda)
-- ---------------------------------------------------------------------
SELECT pe.id_pedido, CONCAT(lc.nombre, ' ', lc.apellido) AS lector, pe.modalidad, pe.estado,
       SUM(d.cantidad * d.precio_unitario) AS subtotal, pe.costo_envio,
       SUM(d.cantidad * d.precio_unitario) + pe.costo_envio AS total
FROM pedido pe JOIN lector lc USING (id_lector) JOIN pedido_detalle d USING (id_pedido)
GROUP BY pe.id_pedido
ORDER BY pe.id_pedido;

-- ---------------------------------------------------------------------
-- 11. RN-21: última verificación de cada estante auditado (calculada, no guardada)
-- ---------------------------------------------------------------------
SELECT sd.nombre AS sede, a.pasillo, a.estante, MAX(a.fecha_cierre) AS ultima_verificacion,
       SUM(h.decision = 'pendiente') AS hallazgos_pendientes
FROM auditoria_estante a
JOIN sede sd USING (id_sede)
LEFT JOIN auditoria_hallazgo h USING (id_auditoria)
WHERE a.fecha_cierre IS NOT NULL
GROUP BY sd.id_sede, a.pasillo, a.estante;

-- ---------------------------------------------------------------------
-- 12. RN-24: consulta DETECTORA. Debe devolver 0 filas; si devuelve algo, una operación olvidó
--     actualizar el estado del ejemplar. El orden del CASE es una regla: las decisiones humanas mandan.
-- ---------------------------------------------------------------------
SELECT codigo_barras, guardado, deducido
FROM (
  SELECT e.codigo_barras, e.estado AS guardado,
    CASE
      WHEN e.estado IN ('en_reparacion', 'perdido', 'de_baja') THEN e.estado
      WHEN EXISTS (SELECT 1 FROM prestamo_fisico p WHERE p.id_ejemplar = e.id_ejemplar AND p.fecha_devolucion IS NULL) THEN 'prestado'
      WHEN EXISTS (SELECT 1 FROM reserva_fisica r WHERE r.id_ejemplar = e.id_ejemplar AND r.estado = 'asignada') THEN 'apartado'
      WHEN EXISTS (SELECT 1 FROM traslado_ejemplar te JOIN traslado t USING (id_traslado)
                   WHERE te.id_ejemplar = e.id_ejemplar AND te.estado = 'incluido' AND t.estado = 'en_transito') THEN 'en_transito'
      WHEN e.id_ubicacion IS NULL THEN 'por_ubicar'
      ELSE 'disponible'
    END AS deducido
  FROM ejemplar e
) AS x
WHERE guardado <> deducido;
