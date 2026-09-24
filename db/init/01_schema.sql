-- =====================================================================
-- bibliotecaNext — esquema (MySQL 8.4)
-- Derivado de docs/modelo-datos.md; cada tabla cita sus reglas (docs/reglas-de-negocio.md).
-- Se ejecuta automáticamente sobre la BD de MYSQL_DATABASE la primera vez que se crea el volumen.
-- Convenciones (C-01): snake_case, singular, id_<tabla>. Estados como ENUM (C-02).
-- Juego de caracteres: el predeterminado de MySQL 8.4 (utf8mb4, utf8mb4_0900_ai_ci).
-- =====================================================================

-- =====================================================================
-- Bloque 1 — Catálogo y ubicación
-- =====================================================================

-- C-03: solo para la nacionalidad del autor.
CREATE TABLE pais (
    id_pais  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre   VARCHAR(60) NOT NULL,
    CONSTRAINT uq_pais_nombre UNIQUE (nombre)
);

-- C-03, RN-42: sedes, direcciones de envío y tarifas. Hay municipios homónimos en distintos departamentos.
CREATE TABLE ciudad (
    id_ciudad     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(80) NOT NULL,
    departamento  VARCHAR(60) NOT NULL,
    CONSTRAINT uq_ciudad UNIQUE (nombre, departamento)
);

-- C-02: catálogo editable.
CREATE TABLE editorial (
    id_editorial  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    CONSTRAINT uq_editorial_nombre UNIQUE (nombre)
);

CREATE TABLE autor (
    id_autor  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre    VARCHAR(60) NOT NULL,
    apellido  VARCHAR(60) NOT NULL,
    id_pais   INT UNSIGNED NULL,                 -- se puede no conocer la nacionalidad
    CONSTRAINT fk_autor_pais FOREIGN KEY (id_pais) REFERENCES pais (id_pais)
);

-- RN-46: edad_minima permite calcular si un lector puede acceder a un título.
CREATE TABLE clasificacion_edad (
    id_clasificacion  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre            VARCHAR(30) NOT NULL,
    edad_minima       TINYINT UNSIGNED NOT NULL,
    CONSTRAINT uq_clasificacion_nombre UNIQUE (nombre),
    CONSTRAINT uq_clasificacion_edad UNIQUE (edad_minima)
);

-- RN-18: secciones y colores de toda la red; un color por sección.
CREATE TABLE seccion (
    id_seccion  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(60) NOT NULL,
    color_hex   CHAR(7) NOT NULL,
    CONSTRAINT uq_seccion_nombre UNIQUE (nombre),
    CONSTRAINT uq_seccion_color UNIQUE (color_hex),
    CONSTRAINT ck_seccion_color CHECK (color_hex REGEXP '^#[0-9A-Fa-f]{6}$')
);

-- RN-19: cada género pertenece a una sola sección.
CREATE TABLE genero (
    id_genero   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(60) NOT NULL,
    id_seccion  INT UNSIGNED NOT NULL,
    CONSTRAINT uq_genero_nombre UNIQUE (nombre),
    CONSTRAINT fk_genero_seccion FOREIGN KEY (id_seccion) REFERENCES seccion (id_seccion)
);

-- La obra (no la copia física). RN-19: el género principal decide sección y color. RN-46: clasificación.
CREATE TABLE libro (
    id_libro             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    isbn                 VARCHAR(13) NOT NULL,   -- sin guiones: ISBN-10 o ISBN-13
    titulo               VARCHAR(255) NOT NULL,
    anio_publicacion     SMALLINT UNSIGNED NULL,
    sinopsis             TEXT NULL,
    id_editorial         INT UNSIGNED NOT NULL,
    id_clasificacion     INT UNSIGNED NOT NULL,
    id_genero_principal  INT UNSIGNED NOT NULL,
    CONSTRAINT uq_libro_isbn UNIQUE (isbn),
    CONSTRAINT ck_libro_isbn CHECK (isbn REGEXP '^([0-9]{9}[0-9X]|[0-9]{13})$'),
    CONSTRAINT ck_libro_anio CHECK (anio_publicacion BETWEEN 1000 AND 2100),
    CONSTRAINT fk_libro_editorial FOREIGN KEY (id_editorial) REFERENCES editorial (id_editorial),
    CONSTRAINT fk_libro_clasificacion FOREIGN KEY (id_clasificacion) REFERENCES clasificacion_edad (id_clasificacion),
    CONSTRAINT fk_libro_genero_principal FOREIGN KEY (id_genero_principal) REFERENCES genero (id_genero)
);

-- N:M libro-autor. Borrar un libro borra sus vínculos; un autor con libros no se puede borrar.
CREATE TABLE autor_libro (
    id_autor  INT UNSIGNED NOT NULL,
    id_libro  INT UNSIGNED NOT NULL,
    PRIMARY KEY (id_autor, id_libro),
    CONSTRAINT fk_autor_libro_autor FOREIGN KEY (id_autor) REFERENCES autor (id_autor),
    CONSTRAINT fk_autor_libro_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro) ON DELETE CASCADE
);

-- RN-19: solo géneros SECUNDARIOS. Que no repita el principal se valida en lib/actions (involucra otra tabla).
CREATE TABLE libro_genero (
    id_libro   INT UNSIGNED NOT NULL,
    id_genero  INT UNSIGNED NOT NULL,
    PRIMARY KEY (id_libro, id_genero),
    CONSTRAINT fk_libro_genero_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro) ON DELETE CASCADE,
    CONSTRAINT fk_libro_genero_genero FOREIGN KEY (id_genero) REFERENCES genero (id_genero)
);

-- D-01: antes "Biblioteca" en BD2.
CREATE TABLE sede (
    id_sede           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,
    calle             VARCHAR(120) NOT NULL,
    codigo_postal     VARCHAR(10) NULL,
    telefono          VARCHAR(20) NULL,
    horario_apertura  TIME NOT NULL,
    horario_cierre    TIME NOT NULL,
    id_ciudad         INT UNSIGNED NOT NULL,
    CONSTRAINT uq_sede_nombre UNIQUE (nombre),
    CONSTRAINT ck_sede_horario CHECK (horario_cierre > horario_apertura),
    CONSTRAINT fk_sede_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad)
);

-- RN-17, RN-18: una fila = un nivel de un estante, dentro de una sección, en una sede.
CREATE TABLE ubicacion (
    id_ubicacion  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sede       INT UNSIGNED NOT NULL,
    id_seccion    INT UNSIGNED NOT NULL,
    pasillo       VARCHAR(5) NOT NULL,
    estante       TINYINT UNSIGNED NOT NULL,
    nivel         TINYINT UNSIGNED NOT NULL,
    CONSTRAINT uq_ubicacion_lugar UNIQUE (id_sede, pasillo, estante, nivel),
    CONSTRAINT uq_ubicacion_sede UNIQUE (id_ubicacion, id_sede),   -- destino de la FK compuesta de ejemplar
    CONSTRAINT ck_ubicacion_numeros CHECK (estante > 0 AND nivel > 0),
    CONSTRAINT fk_ubicacion_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede),
    CONSTRAINT fk_ubicacion_seccion FOREIGN KEY (id_seccion) REFERENCES seccion (id_seccion)
);

-- La copia física. RN-06, RN-13, RN-20, RN-22, RN-23, RN-47.
CREATE TABLE ejemplar (
    id_ejemplar        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo_barras      VARCHAR(30) NOT NULL,
    id_libro           INT UNSIGNED NOT NULL,
    id_sede            INT UNSIGNED NOT NULL,
    id_ubicacion       INT UNSIGNED NULL,        -- NULL mientras está por ubicar o en tránsito
    estado             ENUM('disponible', 'apartado', 'prestado', 'por_ubicar', 'en_transito',
                            'en_reparacion', 'perdido', 'de_baja') NOT NULL DEFAULT 'por_ubicar',
    valor_reposicion   DECIMAL(10,2) NOT NULL,   -- RN-06
    fecha_adquisicion  DATE NOT NULL,
    CONSTRAINT uq_ejemplar_codigo UNIQUE (codigo_barras),
    CONSTRAINT ck_ejemplar_valor CHECK (valor_reposicion > 0),
    -- RN-20, RN-22: coherencia entre estado y ubicación.
    CONSTRAINT ck_ejemplar_sin_ubicacion CHECK (estado NOT IN ('por_ubicar', 'en_transito') OR id_ubicacion IS NULL),
    CONSTRAINT ck_ejemplar_disponible_ubicado CHECK (estado <> 'disponible' OR id_ubicacion IS NOT NULL),
    CONSTRAINT fk_ejemplar_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro),
    CONSTRAINT fk_ejemplar_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede),
    -- La ubicación debe ser de la MISMA sede que el ejemplar. Sin acciones ON DELETE/UPDATE:
    -- id_ubicacion se usa en un CHECK (limitación de MySQL a verificar) y no se borra un estante con libros.
    CONSTRAINT fk_ejemplar_ubicacion FOREIGN KEY (id_ubicacion, id_sede) REFERENCES ubicacion (id_ubicacion, id_sede)
);
