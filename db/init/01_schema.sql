-- Este archivo está en UTF-8: el cliente mysql del contenedor se conecta en latin1 por defecto y, sin esto,
-- las letras con tilde quedan doblemente codificadas ("aÃ±os" en vez de "años").
SET NAMES utf8mb4;

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

-- =====================================================================
-- Bloque 2 — Cuentas, lectores, préstamos físicos, reservas y multas
-- =====================================================================

-- C-04 y valores iniciales: una sola fila con columnas tipadas (no clave-valor).
CREATE TABLE configuracion (
    id                               TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
    max_renovaciones                 TINYINT UNSIGNED NOT NULL,   -- RN-04
    multa_por_dia                    DECIMAL(10,2) NOT NULL,      -- RN-05
    multa_tope                       DECIMAL(10,2) NOT NULL,      -- RN-05
    dias_atraso_perdido              SMALLINT UNSIGNED NOT NULL,  -- RN-49
    horas_confirmar_reserva_digital  SMALLINT UNSIGNED NOT NULL,  -- RN-28
    minutos_pago_pedido              SMALLINT UNSIGNED NOT NULL,  -- RN-37
    dias_devolucion_compra           SMALLINT UNSIGNED NOT NULL,  -- RN-41
    minimo_sobrante_traslado         TINYINT UNSIGNED NOT NULL,   -- RN-14
    CONSTRAINT ck_configuracion_unica CHECK (id = 1),
    CONSTRAINT ck_configuracion_multa CHECK (multa_por_dia > 0 AND multa_tope >= multa_por_dia),
    CONSTRAINT ck_configuracion_plazos CHECK (dias_atraso_perdido > 0 AND horas_confirmar_reserva_digital > 0
                                              AND minutos_pago_pedido > 0 AND dias_devolucion_compra > 0)
);

-- RN-02, RN-12, RN-26, RN-45: límites por tipo de lector, en datos.
CREATE TABLE tipo_lector (
    id_tipo_lector           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre                   VARCHAR(40) NOT NULL,
    max_prestamos_fisicos    TINYINT UNSIGNED NOT NULL,
    dias_prestamo_fisico     TINYINT UNSIGNED NOT NULL,
    max_prestamos_digitales  TINYINT UNSIGNED NOT NULL,
    dias_prestamo_digital    TINYINT UNSIGNED NOT NULL,
    max_reservas_fisicas     TINYINT UNSIGNED NOT NULL,
    max_reservas_digitales   TINYINT UNSIGNED NOT NULL,
    dias_recoger_reserva     TINYINT UNSIGNED NOT NULL,
    CONSTRAINT uq_tipo_lector_nombre UNIQUE (nombre),
    CONSTRAINT ck_tipo_lector_dias CHECK (dias_prestamo_fisico > 0 AND dias_prestamo_digital > 0 AND dias_recoger_reserva > 0)
);

-- RN-01, RN-31: la persona que inicia sesión. Sin columna de estado: se deduce de las fechas.
CREATE TABLE cuenta (
    id_cuenta            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    correo               VARCHAR(254) NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    fecha_registro       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_verificacion   DATETIME NULL,      -- RN-32
    fecha_desactivacion  DATETIME NULL,
    CONSTRAINT uq_cuenta_correo UNIQUE (correo),
    CONSTRAINT ck_cuenta_fechas CHECK (fecha_verificacion IS NULL OR fecha_verificacion >= fecha_registro)
);

-- RN-32: se guarda el HASH del token (SHA-256 en hex), nunca el token. Un solo uso y con vencimiento.
CREATE TABLE token_cuenta (
    id_token    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cuenta   INT UNSIGNED NOT NULL,
    token_hash  CHAR(64) NOT NULL,
    tipo        ENUM('verificar_correo', 'recuperar_contrasena') NOT NULL,
    creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_en   DATETIME NOT NULL,
    usado_en    DATETIME NULL,
    CONSTRAINT uq_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_token_expira CHECK (expira_en > creado_en),
    CONSTRAINT fk_token_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta (id_cuenta) ON DELETE CASCADE
);

-- RN-33, RN-34: rol y sede. El administrador de red no tiene sede; los demás, exactamente una.
CREATE TABLE empleado (
    id_empleado         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cuenta           INT UNSIGNED NOT NULL,
    nombre              VARCHAR(60) NOT NULL,
    apellido            VARCHAR(60) NOT NULL,
    rol                 ENUM('bibliotecario', 'coordinador', 'admin_red') NOT NULL,
    id_sede             INT UNSIGNED NULL,
    fecha_contratacion  DATE NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_empleado_cuenta UNIQUE (id_cuenta),
    CONSTRAINT ck_empleado_sede CHECK ((rol = 'admin_red') = (id_sede IS NULL)),
    CONSTRAINT fk_empleado_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta (id_cuenta),
    CONSTRAINT fk_empleado_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede)
);

-- D-02, D-03, RN-02, RN-46. Documento y validación quedan NULL hasta la validación en mostrador.
CREATE TABLE lector (
    id_lector              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cuenta              INT UNSIGNED NOT NULL,
    id_tipo_lector         INT UNSIGNED NOT NULL,
    nombre                 VARCHAR(60) NOT NULL,
    apellido               VARCHAR(60) NOT NULL,
    fecha_nacimiento       DATE NOT NULL,           -- RN-46: la edad se calcula
    telefono               VARCHAR(20) NULL,
    calle                  VARCHAR(120) NULL,
    codigo_postal          VARCHAR(10) NULL,
    id_ciudad              INT UNSIGNED NULL,
    tipo_documento         ENUM('CC', 'TI', 'CE', 'PASAPORTE') NULL,
    numero_documento       VARCHAR(20) NULL,
    fecha_validacion       DATETIME NULL,           -- D-03
    id_empleado_validador  INT UNSIGNED NULL,
    CONSTRAINT uq_lector_cuenta UNIQUE (id_cuenta),
    CONSTRAINT uq_lector_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT ck_lector_documento CHECK ((tipo_documento IS NULL) = (numero_documento IS NULL)),
    -- Validar = quién y cuándo, y exige documento.
    CONSTRAINT ck_lector_validacion CHECK ((fecha_validacion IS NULL) = (id_empleado_validador IS NULL)
                                           AND (fecha_validacion IS NULL OR tipo_documento IS NOT NULL)),
    CONSTRAINT fk_lector_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta (id_cuenta),
    CONSTRAINT fk_lector_tipo FOREIGN KEY (id_tipo_lector) REFERENCES tipo_lector (id_tipo_lector),
    CONSTRAINT fk_lector_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad),
    CONSTRAINT fk_lector_validador FOREIGN KEY (id_empleado_validador) REFERENCES empleado (id_empleado)
);

-- RN-02 a RN-05, RN-13, RN-34. Estado (activo / vencido / devuelto) calculado con las fechas.
CREATE TABLE prestamo_fisico (
    id_prestamo         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_ejemplar         INT UNSIGNED NOT NULL,
    id_lector           INT UNSIGNED NOT NULL,
    id_sede_prestamo    INT UNSIGNED NOT NULL,
    id_empleado_presta  INT UNSIGNED NOT NULL,
    fecha_prestamo      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento   DATE NOT NULL,
    renovaciones        TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- RN-04: el máximo está en configuracion
    fecha_devolucion    DATETIME NULL,
    id_sede_devolucion  INT UNSIGNED NULL,                      -- RN-13: puede ser otra sede
    id_empleado_recibe  INT UNSIGNED NULL,
    -- Unicidad parcial: vale id_ejemplar solo mientras el préstamo está abierto (NULL no compite en UNIQUE).
    ejemplar_abierto    INT UNSIGNED AS (IF(fecha_devolucion IS NULL, id_ejemplar, NULL)) VIRTUAL,
    CONSTRAINT uq_prestamo_ejemplar_abierto UNIQUE (ejemplar_abierto),
    CONSTRAINT ck_prestamo_devolucion CHECK ((fecha_devolucion IS NULL) = (id_sede_devolucion IS NULL)
                                             AND (fecha_devolucion IS NULL) = (id_empleado_recibe IS NULL)),
    CONSTRAINT ck_prestamo_fechas CHECK (fecha_vencimiento >= DATE(fecha_prestamo)
                                         AND (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_prestamo)),
    CONSTRAINT fk_prestamo_ejemplar FOREIGN KEY (id_ejemplar) REFERENCES ejemplar (id_ejemplar),
    CONSTRAINT fk_prestamo_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_prestamo_sede FOREIGN KEY (id_sede_prestamo) REFERENCES sede (id_sede),
    CONSTRAINT fk_prestamo_empleado_presta FOREIGN KEY (id_empleado_presta) REFERENCES empleado (id_empleado),
    CONSTRAINT fk_prestamo_sede_devolucion FOREIGN KEY (id_sede_devolucion) REFERENCES sede (id_sede),
    CONSTRAINT fk_prestamo_empleado_recibe FOREIGN KEY (id_empleado_recibe) REFERENCES empleado (id_empleado),
    INDEX idx_prestamo_lector_abierto (id_lector, fecha_devolucion)   -- RN-03: bloqueo y límites del lector
);

-- RN-05, RN-06, RN-49. Un préstamo no genera dos multas del mismo tipo.
CREATE TABLE multa (
    id_multa        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_prestamo     INT UNSIGNED NOT NULL,
    tipo            ENUM('retraso', 'reposicion') NOT NULL,
    monto           DECIMAL(10,2) NOT NULL,
    fecha_generada  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado          ENUM('pendiente', 'pagada', 'anulada') NOT NULL DEFAULT 'pendiente',
    fecha_pago      DATETIME NULL,
    CONSTRAINT uq_multa_prestamo_tipo UNIQUE (id_prestamo, tipo),
    CONSTRAINT ck_multa_monto CHECK (monto > 0),
    CONSTRAINT ck_multa_pago CHECK ((estado = 'pagada') = (fecha_pago IS NOT NULL)),
    CONSTRAINT fk_multa_prestamo FOREIGN KEY (id_prestamo) REFERENCES prestamo_fisico (id_prestamo)
);

-- RN-07 a RN-12. Reserva de una OBRA en una SEDE. Cola: ORDER BY fecha_solicitud, id_reserva.
-- Que el ejemplar asignado sea de esa obra y sede se valida en lib/actions: una FK compuesta hacia
-- ejemplar impediría cambiar su sede (colección flotante, RN-13) mientras exista la reserva.
CREATE TABLE reserva_fisica (
    id_reserva             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_lector              INT UNSIGNED NOT NULL,
    id_libro               INT UNSIGNED NOT NULL,
    id_sede                INT UNSIGNED NOT NULL,
    estado                 ENUM('activa', 'asignada', 'cumplida', 'vencida', 'cancelada') NOT NULL DEFAULT 'activa',
    fecha_solicitud        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_ejemplar            INT UNSIGNED NULL,
    fecha_asignacion       DATETIME NULL,
    fecha_limite_recogida  DATETIME NULL,
    fecha_cierre           DATETIME NULL,
    id_prestamo            INT UNSIGNED NULL,
    -- Una sola reserva viva (activa o asignada) por lector y obra.
    libro_vivo             INT UNSIGNED AS (IF(estado IN ('activa', 'asignada'), id_libro, NULL)) VIRTUAL,
    CONSTRAINT uq_reserva_viva UNIQUE (id_lector, libro_vivo),
    CONSTRAINT uq_reserva_prestamo UNIQUE (id_prestamo),
    CONSTRAINT ck_reserva_activa CHECK (estado <> 'activa' OR id_ejemplar IS NULL),
    CONSTRAINT ck_reserva_asignada CHECK (estado <> 'asignada'
                                          OR (id_ejemplar IS NOT NULL AND fecha_asignacion IS NOT NULL AND fecha_limite_recogida IS NOT NULL)),
    CONSTRAINT ck_reserva_cumplida CHECK (estado <> 'cumplida' OR id_prestamo IS NOT NULL),
    CONSTRAINT ck_reserva_cierre CHECK ((estado IN ('cumplida', 'vencida', 'cancelada')) = (fecha_cierre IS NOT NULL)),
    CONSTRAINT fk_reserva_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_reserva_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro),
    CONSTRAINT fk_reserva_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede),
    CONSTRAINT fk_reserva_ejemplar FOREIGN KEY (id_ejemplar) REFERENCES ejemplar (id_ejemplar),
    CONSTRAINT fk_reserva_prestamo FOREIGN KEY (id_prestamo) REFERENCES prestamo_fisico (id_prestamo),
    INDEX idx_reserva_cola (id_libro, id_sede, estado, fecha_solicitud)   -- RN-09, RN-11: buscar la cola
);

-- =====================================================================
-- Bloque 3 — Operación de sede: traslados y auditorías
-- =====================================================================

-- RN-14 a RN-16, RN-50: cabecera del envío por lote entre dos sedes.
CREATE TABLE traslado (
    id_traslado           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sede_origen        INT UNSIGNED NOT NULL,
    id_sede_destino       INT UNSIGNED NOT NULL,
    estado                ENUM('pendiente', 'en_transito', 'recibido', 'cancelado') NOT NULL DEFAULT 'pendiente',
    id_empleado_confirma  INT UNSIGNED NOT NULL,    -- RN-15
    fecha_confirmacion    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_empleado_despacha  INT UNSIGNED NULL,
    fecha_despacho        DATETIME NULL,
    id_empleado_recibe    INT UNSIGNED NULL,
    fecha_recepcion       DATETIME NULL,
    fecha_cancelacion     DATETIME NULL,
    CONSTRAINT ck_traslado_sedes CHECK (id_sede_origen <> id_sede_destino),
    CONSTRAINT ck_traslado_despacho CHECK ((fecha_despacho IS NULL) = (id_empleado_despacha IS NULL)),
    CONSTRAINT ck_traslado_recepcion CHECK ((fecha_recepcion IS NULL) = (id_empleado_recibe IS NULL)),
    -- Coherencia estado ↔ fechas. Solo se cancela antes del despacho (RN-16).
    CONSTRAINT ck_traslado_estado CHECK (
        (estado = 'pendiente'   AND fecha_despacho IS NULL     AND fecha_recepcion IS NULL     AND fecha_cancelacion IS NULL) OR
        (estado = 'en_transito' AND fecha_despacho IS NOT NULL AND fecha_recepcion IS NULL     AND fecha_cancelacion IS NULL) OR
        (estado = 'recibido'    AND fecha_despacho IS NOT NULL AND fecha_recepcion IS NOT NULL AND fecha_cancelacion IS NULL) OR
        (estado = 'cancelado'   AND fecha_despacho IS NULL     AND fecha_recepcion IS NULL     AND fecha_cancelacion IS NOT NULL)),
    CONSTRAINT ck_traslado_orden CHECK ((fecha_despacho IS NULL OR fecha_despacho >= fecha_confirmacion)
                                        AND (fecha_recepcion IS NULL OR fecha_recepcion >= fecha_despacho)),
    CONSTRAINT fk_traslado_origen FOREIGN KEY (id_sede_origen) REFERENCES sede (id_sede),
    CONSTRAINT fk_traslado_destino FOREIGN KEY (id_sede_destino) REFERENCES sede (id_sede),
    CONSTRAINT fk_traslado_confirma FOREIGN KEY (id_empleado_confirma) REFERENCES empleado (id_empleado),
    CONSTRAINT fk_traslado_despacha FOREIGN KEY (id_empleado_despacha) REFERENCES empleado (id_empleado),
    CONSTRAINT fk_traslado_recibe FOREIGN KEY (id_empleado_recibe) REFERENCES empleado (id_empleado)
);

-- RN-51, RN-52: detalle del lote. 'cancelado' = no estaba disponible al despachar.
-- Que un ejemplar no esté en dos traslados abiertos se valida en lib/actions (el estado vive en la cabecera).
CREATE TABLE traslado_ejemplar (
    id_traslado  INT UNSIGNED NOT NULL,
    id_ejemplar  INT UNSIGNED NOT NULL,
    estado       ENUM('incluido', 'cancelado') NOT NULL DEFAULT 'incluido',
    PRIMARY KEY (id_traslado, id_ejemplar),
    CONSTRAINT fk_traslado_ejemplar_traslado FOREIGN KEY (id_traslado) REFERENCES traslado (id_traslado),
    CONSTRAINT fk_traslado_ejemplar_ejemplar FOREIGN KEY (id_ejemplar) REFERENCES ejemplar (id_ejemplar)
);

-- RN-21, RN-53: un estante = (sede, pasillo, estante) con todos sus niveles. Abierta ⇔ fecha_cierre NULL.
-- Que el estante exista en ubicacion se valida en lib/actions (ubicacion es única por nivel, no por estante).
CREATE TABLE auditoria_estante (
    id_auditoria  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_sede       INT UNSIGNED NOT NULL,
    pasillo       VARCHAR(5) NOT NULL,
    estante       TINYINT UNSIGNED NOT NULL,
    id_empleado   INT UNSIGNED NOT NULL,
    fecha_inicio  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre  DATETIME NULL,
    -- Una sola auditoría abierta por estante (unicidad parcial).
    abierta       TINYINT AS (IF(fecha_cierre IS NULL, 1, NULL)) VIRTUAL,
    CONSTRAINT uq_auditoria_abierta UNIQUE (id_sede, pasillo, estante, abierta),
    CONSTRAINT ck_auditoria_fechas CHECK (fecha_cierre IS NULL OR fecha_cierre >= fecha_inicio),
    CONSTRAINT fk_auditoria_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede),
    CONSTRAINT fk_auditoria_empleado FOREIGN KEY (id_empleado) REFERENCES empleado (id_empleado),
    INDEX idx_auditoria_estante (id_sede, pasillo, estante, fecha_cierre)   -- RN-21: última verificación
);

-- RN-53: lo leído tal cual, aunque el código no exista (id_ejemplar NULL).
CREATE TABLE auditoria_lectura (
    id_lectura     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_auditoria   INT UNSIGNED NOT NULL,
    codigo_barras  VARCHAR(30) NOT NULL,
    id_ejemplar    INT UNSIGNED NULL,
    id_ubicacion   INT UNSIGNED NOT NULL,     -- nivel donde se encontró
    fecha_lectura  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lectura_codigo UNIQUE (id_auditoria, codigo_barras),   -- leer dos veces no duplica
    CONSTRAINT fk_lectura_auditoria FOREIGN KEY (id_auditoria) REFERENCES auditoria_estante (id_auditoria),
    CONSTRAINT fk_lectura_ejemplar FOREIGN KEY (id_ejemplar) REFERENCES ejemplar (id_ejemplar),
    CONSTRAINT fk_lectura_ubicacion FOREIGN KEY (id_ubicacion) REFERENCES ubicacion (id_ubicacion)
);

-- RN-53: hallazgos calculados al cerrar y CONGELADOS como registro histórico, con la decisión del empleado.
CREATE TABLE auditoria_hallazgo (
    id_hallazgo              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_auditoria             INT UNSIGNED NOT NULL,
    tipo                     ENUM('faltante', 'mal_ubicado', 'estado_incoherente', 'desconocido') NOT NULL,
    codigo_barras            VARCHAR(30) NOT NULL,
    id_ejemplar              INT UNSIGNED NULL,
    id_ubicacion_esperada    INT UNSIGNED NULL,
    id_ubicacion_encontrada  INT UNSIGNED NULL,
    decision                 ENUM('pendiente', 'aplicada', 'descartada') NOT NULL DEFAULT 'pendiente',
    id_empleado_decide       INT UNSIGNED NULL,
    fecha_decision           DATETIME NULL,
    CONSTRAINT uq_hallazgo_codigo UNIQUE (id_auditoria, codigo_barras),
    CONSTRAINT ck_hallazgo_decision CHECK ((decision = 'pendiente') = (fecha_decision IS NULL)
                                           AND (fecha_decision IS NULL) = (id_empleado_decide IS NULL)),
    -- Qué datos exige cada tipo de hallazgo.
    CONSTRAINT ck_hallazgo_tipo CHECK (
        (tipo = 'desconocido'        AND id_ejemplar IS NULL     AND id_ubicacion_encontrada IS NOT NULL) OR
        (tipo = 'faltante'           AND id_ejemplar IS NOT NULL AND id_ubicacion_esperada IS NOT NULL AND id_ubicacion_encontrada IS NULL) OR
        (tipo = 'mal_ubicado'        AND id_ejemplar IS NOT NULL AND id_ubicacion_esperada IS NOT NULL AND id_ubicacion_encontrada IS NOT NULL) OR
        (tipo = 'estado_incoherente' AND id_ejemplar IS NOT NULL AND id_ubicacion_encontrada IS NOT NULL)),
    CONSTRAINT fk_hallazgo_auditoria FOREIGN KEY (id_auditoria) REFERENCES auditoria_estante (id_auditoria),
    CONSTRAINT fk_hallazgo_ejemplar FOREIGN KEY (id_ejemplar) REFERENCES ejemplar (id_ejemplar),
    CONSTRAINT fk_hallazgo_esperada FOREIGN KEY (id_ubicacion_esperada) REFERENCES ubicacion (id_ubicacion),
    CONSTRAINT fk_hallazgo_encontrada FOREIGN KEY (id_ubicacion_encontrada) REFERENCES ubicacion (id_ubicacion),
    CONSTRAINT fk_hallazgo_empleado FOREIGN KEY (id_empleado_decide) REFERENCES empleado (id_empleado)
);

-- =====================================================================
-- Bloque 4 — Préstamo digital
-- =====================================================================

-- RN-29, RN-54: archivos del título por formato. clave_archivo = nombre en el almacenamiento privado,
-- nunca una URL pública.
CREATE TABLE edicion_digital (
    id_edicion     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_libro       INT UNSIGNED NOT NULL,
    formato        ENUM('pdf', 'epub') NOT NULL,
    clave_archivo  VARCHAR(255) NOT NULL,
    tamano_bytes   INT UNSIGNED NOT NULL,
    fecha_carga    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_edicion_libro_formato UNIQUE (id_libro, formato),
    CONSTRAINT uq_edicion_clave UNIQUE (clave_archivo),
    CONSTRAINT ck_edicion_tamano CHECK (tamano_bytes > 0),
    CONSTRAINT fk_edicion_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro)
);

-- RN-25, RN-54: lote de licencias de un TÍTULO (sirve para cualquier formato).
CREATE TABLE licencia_digital (
    id_licencia           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_libro              INT UNSIGNED NOT NULL,
    cantidad              SMALLINT UNSIGNED NOT NULL,   -- lecturas simultáneas
    fecha_adquisicion     DATE NOT NULL,
    fecha_vencimiento     DATE NULL,                    -- NULL = no vence
    id_empleado_registra  INT UNSIGNED NOT NULL,
    CONSTRAINT uq_licencia_libro UNIQUE (id_licencia, id_libro),   -- destino de la FK compuesta de reserva_digital
    CONSTRAINT ck_licencia_cantidad CHECK (cantidad > 0),
    CONSTRAINT ck_licencia_fechas CHECK (fecha_vencimiento IS NULL OR fecha_vencimiento > fecha_adquisicion),
    CONSTRAINT fk_licencia_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro),
    CONSTRAINT fk_licencia_empleado FOREIGN KEY (id_empleado_registra) REFERENCES empleado (id_empleado)
);

-- RN-26, RN-27, RN-44, RN-55. Vigente ⇔ fecha_devolucion IS NULL AND fecha_fin > NOW() (calculado: vence solo).
-- fecha_fin ya viene recortada por el vencimiento de la licencia (RN-44) al crear el préstamo.
CREATE TABLE prestamo_digital (
    id_prestamo_digital  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_lector            INT UNSIGNED NOT NULL,
    id_licencia          INT UNSIGNED NOT NULL,
    fecha_inicio         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin            DATETIME NOT NULL,
    fecha_devolucion     DATETIME NULL,        -- RN-27: devolución anticipada
    CONSTRAINT ck_prestamo_digital_fechas CHECK (fecha_fin > fecha_inicio
                                                 AND (fecha_devolucion IS NULL OR fecha_devolucion >= fecha_inicio)),
    CONSTRAINT fk_prestamo_digital_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_prestamo_digital_licencia FOREIGN KEY (id_licencia) REFERENCES licencia_digital (id_licencia),
    INDEX idx_prestamo_digital_en_uso (id_licencia, fecha_devolucion, fecha_fin),   -- RN-56: contar licencias en uso
    INDEX idx_prestamo_digital_lector (id_lector, fecha_devolucion)
);

-- RN-28, RN-45, RN-56. Como reserva_fisica, sin sede. Al asignarse retiene un lote de licencias.
CREATE TABLE reserva_digital (
    id_reserva_digital         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_lector                  INT UNSIGNED NOT NULL,
    id_libro                   INT UNSIGNED NOT NULL,
    estado                     ENUM('activa', 'asignada', 'cumplida', 'vencida', 'cancelada') NOT NULL DEFAULT 'activa',
    fecha_solicitud            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_licencia                INT UNSIGNED NULL,
    fecha_asignacion           DATETIME NULL,
    fecha_limite_confirmacion  DATETIME NULL,
    fecha_cierre               DATETIME NULL,
    id_prestamo_digital        INT UNSIGNED NULL,
    libro_vivo                 INT UNSIGNED AS (IF(estado IN ('activa', 'asignada'), id_libro, NULL)) VIRTUAL,
    CONSTRAINT uq_reserva_digital_viva UNIQUE (id_lector, libro_vivo),
    CONSTRAINT uq_reserva_digital_prestamo UNIQUE (id_prestamo_digital),
    CONSTRAINT ck_reserva_digital_activa CHECK (estado <> 'activa' OR id_licencia IS NULL),
    CONSTRAINT ck_reserva_digital_asignada CHECK (estado <> 'asignada'
        OR (id_licencia IS NOT NULL AND fecha_asignacion IS NOT NULL AND fecha_limite_confirmacion IS NOT NULL)),
    CONSTRAINT ck_reserva_digital_cumplida CHECK (estado <> 'cumplida' OR id_prestamo_digital IS NOT NULL),
    CONSTRAINT ck_reserva_digital_cierre CHECK ((estado IN ('cumplida', 'vencida', 'cancelada')) = (fecha_cierre IS NOT NULL)),
    CONSTRAINT fk_reserva_digital_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_reserva_digital_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro),
    -- El lote retenido debe ser del mismo libro. FK compuesta segura: licencia_digital.id_libro nunca cambia.
    CONSTRAINT fk_reserva_digital_licencia FOREIGN KEY (id_licencia, id_libro) REFERENCES licencia_digital (id_licencia, id_libro),
    CONSTRAINT fk_reserva_digital_prestamo FOREIGN KEY (id_prestamo_digital) REFERENCES prestamo_digital (id_prestamo_digital),
    INDEX idx_reserva_digital_cola (id_libro, estado, fecha_solicitud)
);

-- =====================================================================
-- Bloque 5 — Compras
-- =====================================================================

-- D-05: lo que se vende, un título en formato físico o digital. Precio ACTUAL; el histórico queda en cada pedido.
CREATE TABLE producto (
    id_producto  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_libro     INT UNSIGNED NOT NULL,
    tipo         ENUM('fisico', 'digital') NOT NULL,
    precio       DECIMAL(10,2) NOT NULL,
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_producto_libro_tipo UNIQUE (id_libro, tipo),
    CONSTRAINT ck_producto_precio CHECK (precio > 0),
    CONSTRAINT fk_producto_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro)
);

-- RN-36, RN-37: stock de venta por sede, separado de los ejemplares de préstamo. UNSIGNED: nunca negativo.
-- Candado al apartar: UPDATE ... SET cantidad = cantidad - ? WHERE ... AND cantidad >= ?
CREATE TABLE stock_venta (
    id_producto  INT UNSIGNED NOT NULL,
    id_sede      INT UNSIGNED NOT NULL,
    cantidad     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id_producto, id_sede),
    CONSTRAINT fk_stock_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto),
    CONSTRAINT fk_stock_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede)
);

-- RN-42: tarifa por ciudad de destino. Sin fila = no se envía a esa ciudad.
CREATE TABLE tarifa_envio (
    id_ciudad           INT UNSIGNED PRIMARY KEY,
    valor               DECIMAL(10,2) NOT NULL,
    monto_envio_gratis  DECIMAL(10,2) NULL,
    CONSTRAINT ck_tarifa_valores CHECK (valor >= 0 AND (monto_envio_gratis IS NULL OR monto_envio_gratis > 0)),
    CONSTRAINT fk_tarifa_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad)
);

-- RN-57: carrito en la BD por lector. No aparta stock.
CREATE TABLE carrito_item (
    id_lector       INT UNSIGNED NOT NULL,
    id_producto     INT UNSIGNED NOT NULL,
    cantidad        SMALLINT UNSIGNED NOT NULL,
    fecha_agregado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_lector, id_producto),
    CONSTRAINT ck_carrito_cantidad CHECK (cantidad > 0),
    CONSTRAINT fk_carrito_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_carrito_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
);

-- RN-37, RN-38, RN-40, RN-58. Dirección y costo de envío CONGELADOS; subtotal y total se calculan del detalle.
CREATE TABLE pedido (
    id_pedido             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_lector             INT UNSIGNED NOT NULL,
    modalidad             ENUM('recoger', 'envio', 'solo_digital') NOT NULL,
    estado                ENUM('pendiente_pago', 'pagado', 'preparado', 'listo_para_recoger', 'enviado',
                               'entregado', 'vencido', 'cancelado', 'reembolsado') NOT NULL DEFAULT 'pendiente_pago',
    id_sede               INT UNSIGNED NULL,          -- RN-38: sede que despacha o entrega
    envio_destinatario    VARCHAR(120) NULL,
    envio_telefono        VARCHAR(20) NULL,
    envio_calle           VARCHAR(120) NULL,
    envio_codigo_postal   VARCHAR(10) NULL,
    envio_id_ciudad       INT UNSIGNED NULL,
    costo_envio           DECIMAL(10,2) NOT NULL DEFAULT 0,
    numero_guia           VARCHAR(40) NULL,
    fecha_creacion        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_limite_pago     DATETIME NOT NULL,          -- RN-37
    fecha_pago            DATETIME NULL,
    fecha_entrega         DATETIME NULL,
    id_empleado_entrega   INT UNSIGNED NULL,          -- solo en recogida en sede
    fecha_cancelacion     DATETIME NULL,
    -- Qué datos exige cada modalidad.
    CONSTRAINT ck_pedido_modalidad CHECK (
        (modalidad = 'recoger' AND id_sede IS NOT NULL AND costo_envio = 0
            AND envio_destinatario IS NULL AND envio_calle IS NULL AND envio_id_ciudad IS NULL AND numero_guia IS NULL) OR
        (modalidad = 'envio' AND id_sede IS NOT NULL AND costo_envio >= 0
            AND envio_destinatario IS NOT NULL AND envio_telefono IS NOT NULL AND envio_calle IS NOT NULL AND envio_id_ciudad IS NOT NULL) OR
        (modalidad = 'solo_digital' AND id_sede IS NULL AND costo_envio = 0
            AND envio_destinatario IS NULL AND envio_calle IS NULL AND envio_id_ciudad IS NULL AND numero_guia IS NULL)),
    -- Qué fechas exige cada estado (máquina de estados, RN-40, RN-58).
    CONSTRAINT ck_pedido_estado CHECK (
        (estado IN ('pendiente_pago', 'vencido') AND fecha_pago IS NULL AND fecha_entrega IS NULL AND fecha_cancelacion IS NULL) OR
        (estado IN ('pagado', 'preparado', 'listo_para_recoger', 'enviado')
            AND fecha_pago IS NOT NULL AND fecha_entrega IS NULL AND fecha_cancelacion IS NULL) OR
        (estado = 'entregado'   AND fecha_pago IS NOT NULL AND fecha_entrega IS NOT NULL AND fecha_cancelacion IS NULL) OR
        (estado = 'cancelado'   AND fecha_pago IS NULL     AND fecha_entrega IS NULL     AND fecha_cancelacion IS NOT NULL) OR
        (estado = 'reembolsado' AND fecha_pago IS NOT NULL AND fecha_entrega IS NULL     AND fecha_cancelacion IS NOT NULL)),
    CONSTRAINT ck_pedido_estado_modalidad CHECK ((estado <> 'listo_para_recoger' OR modalidad = 'recoger')
                                                 AND (estado <> 'enviado' OR modalidad = 'envio')),
    CONSTRAINT ck_pedido_entrega_empleado CHECK (
        (modalidad = 'recoger' AND (fecha_entrega IS NULL) = (id_empleado_entrega IS NULL)) OR
        (modalidad <> 'recoger' AND id_empleado_entrega IS NULL)),
    CONSTRAINT ck_pedido_fechas CHECK (fecha_limite_pago > fecha_creacion AND costo_envio >= 0),
    CONSTRAINT fk_pedido_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_pedido_sede FOREIGN KEY (id_sede) REFERENCES sede (id_sede),
    CONSTRAINT fk_pedido_ciudad FOREIGN KEY (envio_id_ciudad) REFERENCES ciudad (id_ciudad),
    CONSTRAINT fk_pedido_empleado FOREIGN KEY (id_empleado_entrega) REFERENCES empleado (id_empleado),
    INDEX idx_pedido_vencimiento (estado, fecha_limite_pago)   -- RN-48: vencimiento perezoso
);

-- RN-39: precio del momento congelado.
CREATE TABLE pedido_detalle (
    id_pedido        INT UNSIGNED NOT NULL,
    id_producto      INT UNSIGNED NOT NULL,
    cantidad         SMALLINT UNSIGNED NOT NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_pedido, id_producto),
    CONSTRAINT ck_detalle_valores CHECK (cantidad > 0 AND precio_unitario >= 0),
    CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido),
    CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES producto (id_producto)
);

-- D-07, RN-59: varios intentos por pedido, un solo pago exitoso (pagado o luego reembolsado).
CREATE TABLE pago (
    id_pago             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_pedido           INT UNSIGNED NOT NULL,
    monto               DECIMAL(10,2) NOT NULL,
    metodo              ENUM('simulado') NOT NULL DEFAULT 'simulado',   -- se amplía al conectar la pasarela
    estado              ENUM('pendiente', 'pagado', 'fallido', 'reembolsado') NOT NULL DEFAULT 'pendiente',
    referencia_externa  VARCHAR(100) NULL,
    fecha_creacion      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_confirmacion  DATETIME NULL,
    pedido_pagado       INT UNSIGNED AS (IF(estado IN ('pagado', 'reembolsado'), id_pedido, NULL)) VIRTUAL,
    CONSTRAINT uq_pago_exitoso UNIQUE (pedido_pagado),
    CONSTRAINT uq_pago_referencia UNIQUE (referencia_externa),
    CONSTRAINT ck_pago_monto CHECK (monto > 0),
    CONSTRAINT ck_pago_confirmacion CHECK ((estado = 'pendiente') = (fecha_confirmacion IS NULL)),
    CONSTRAINT fk_pago_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido)
);

-- RN-41, RN-60: devolución por ítem, parcial. La FK compuesta al detalle garantiza que el producto
-- estaba en ESE pedido (segura: el detalle no cambia). Que no se devuelva más de lo comprado, en lib/actions.
CREATE TABLE devolucion_compra (
    id_devolucion    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_pedido        INT UNSIGNED NOT NULL,
    id_producto      INT UNSIGNED NOT NULL,
    cantidad         SMALLINT UNSIGNED NOT NULL,
    id_sede_recibe   INT UNSIGNED NOT NULL,
    id_empleado      INT UNSIGNED NOT NULL,
    monto_reembolso  DECIMAL(10,2) NOT NULL,
    fecha            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_devolucion_valores CHECK (cantidad > 0 AND monto_reembolso >= 0),
    CONSTRAINT fk_devolucion_detalle FOREIGN KEY (id_pedido, id_producto) REFERENCES pedido_detalle (id_pedido, id_producto),
    CONSTRAINT fk_devolucion_sede FOREIGN KEY (id_sede_recibe) REFERENCES sede (id_sede),
    CONSTRAINT fk_devolucion_empleado FOREIGN KEY (id_empleado) REFERENCES empleado (id_empleado)
);

-- RN-30, RN-41, RN-61: acceso permanente a un título digital comprado. La PK impide comprarlo dos veces.
CREATE TABLE acceso_digital (
    id_lector              INT UNSIGNED NOT NULL,
    id_libro               INT UNSIGNED NOT NULL,
    id_pedido              INT UNSIGNED NOT NULL,
    fecha_otorgado         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_primera_lectura  DATETIME NULL,     -- "abierto" (RN-41): define si se puede reembolsar
    PRIMARY KEY (id_lector, id_libro),
    CONSTRAINT ck_acceso_fechas CHECK (fecha_primera_lectura IS NULL OR fecha_primera_lectura >= fecha_otorgado),
    CONSTRAINT fk_acceso_lector FOREIGN KEY (id_lector) REFERENCES lector (id_lector),
    CONSTRAINT fk_acceso_libro FOREIGN KEY (id_libro) REFERENCES libro (id_libro),
    CONSTRAINT fk_acceso_pedido FOREIGN KEY (id_pedido) REFERENCES pedido (id_pedido)
);
