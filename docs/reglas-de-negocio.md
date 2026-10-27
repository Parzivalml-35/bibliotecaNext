# Reglas de negocio — bibliotecaNext

> Borrador en construcción (Fase 0 — Diseño del dominio). Fuente de verdad de cómo funciona el sistema:
> el modelo de datos y el código se derivan de este documento, no al revés.
> Las reglas se referencian en el código por su código (ej. `// RN-03`).

## Decisiones de alcance

| # | Decisión |
|---|---|
| D-01 | Sistema para **una red de bibliotecas con varias sedes**. Catálogo y lectores compartidos entre sedes. |
| D-02 | El lector **se registra en la web**. Con la cuenta activa puede leer digital, reservar y comprar. |
| D-03 | Los **préstamos físicos** requieren que un empleado valide la cuenta en una sede, con documento de identidad. |
| D-04 | Los **libros digitales** se prestan con **licencias limitadas**; si todas están en uso, se reserva. El préstamo digital vence solo. |
| D-05 | **Compras** de libros físicos (stock por sede, separado de los ejemplares de préstamo) y digitales (acceso permanente). |
| D-06 | Entrega de compras físicas: **recoger en una sede** o **envío a domicilio**. Se implementa primero la recogida en sede. |
| D-07 | **Pago simulado** con estados reales (pendiente, pagado, fallido, reembolsado), preparado para conectar una pasarela. |

## Lectores y cuentas

| # | Regla |
|---|---|
| RN-01 | El estado de la cuenta **se deduce de hechos guardados con su fecha**, sin columna de estado: `registrada` (existe la cuenta) → `verificada` (`fecha_verificacion`, RN-32) → `validada` (`fecha_validacion` del lector, D-03); `desactivada` si tiene `fecha_desactivacion`. |
| RN-02 | Cada lector tiene un **tipo de lector**. El tipo define el máximo de préstamos físicos simultáneos y los días de préstamo (configurables en datos, no en código). |
| RN-03 | Un lector está **bloqueado para préstamos** mientras tenga multas pendientes o algún préstamo vencido. El bloqueo **se calcula**, no se guarda: al pagar o devolver se desbloquea solo. |

## Préstamos físicos

| # | Regla |
|---|---|
| RN-04 | Un préstamo se puede **renovar** hasta un número máximo de veces, solo si no está vencido y nadie tiene una reserva activa sobre esa obra. |
| RN-05 | La **multa por retraso** es un valor por día con un tope máximo. Se genera al devolver el libro. |
| RN-06 | Si un ejemplar no se devuelve (perdido), se cobra su **valor de reposición**. |
| RN-65 | Al **renovar** (RN-04), el nuevo vencimiento es el vencimiento actual más los días de préstamo del tipo de lector. "Reserva activa sobre esa obra" = alguna reserva **en cola** (`activa`) por la obra, en cualquier sede; una reserva ya `asignada` no impide renovar. La renovación la registra un empleado de la sede donde se hizo el préstamo (RN-34). |
| RN-66 | Una multa se paga **completa** (sin abonos), de dos formas: **en mostrador**, registrada por un empleado (queda el empleado y la sede, RN-34), o **en línea** por el lector desde su cuenta, con el pago simulado de D-07 (`pendiente` → `pagado` o `fallido`). Puede haber varios intentos en línea, pero un solo pago exitoso por multa. |
| RN-67 | Solo el **coordinador de la sede del préstamo** o el **administrador de red** pueden **anular** una multa pendiente, con un **motivo obligatorio**; se registra quién y cuándo. Una multa pagada no se anula. |
| RN-71 | Al declarar un ejemplar **perdido** (RN-49), su préstamo queda abierto como registro de que nunca se devolvió, pero **deja de contar** como préstamo abierto o vencido del lector (RN-02, RN-03): lo que lo bloquea es la multa de reposición hasta que la pague. |
| RN-75 | Un lector **no puede tener dos préstamos físicos abiertos de la misma obra**, sin excepciones (ni siquiera la decide un empleado). Un préstamo de un ejemplar perdido no cuenta (RN-71). Es el espejo de RN-68: tampoco se reserva una obra que ya se tiene prestada, y la página del libro lo dice en vez de mostrar el formulario. |
| RN-76 | Un préstamo físico abierto está **por vencer** cuando faltan `dias_aviso_vencimiento` días o menos para su vencimiento y todavía no venció. Es **solo un aviso**: no bloquea ni cambia nada (el bloqueo es RN-03). El lector lo ve en su cuenta y el empleado en el mostrador, con el color de aviso y el texto de los días que faltan (DI-09 en `diseno.md`). |

## Reservas físicas

| # | Regla |
|---|---|
| RN-07 | Una reserva es sobre **una obra en una sede** elegida por el lector, no sobre un ejemplar concreto. Solo cuentan las copias de esa sede; el sistema no traslada libros por una reserva. |
| RN-08 | El catálogo muestra la **disponibilidad por sede**, para que el lector decida dónde reservar o hacer cola. |
| RN-09 | Si hay copia disponible en la sede elegida, la reserva se **asigna de inmediato** (apartado). Si no, el lector entra en **cola** por orden de llegada. |
| RN-10 | Ciclo de la reserva: `activa` (en cola) → `asignada` (ejemplar apartado, lista para recoger) → `cumplida` al recogerla. Si no la recoge en el plazo, pasa a `vencida` y la copia se asigna al siguiente de la cola. El lector puede `cancelar` antes de recoger. |
| RN-11 | Al **devolver** un ejemplar, antes de dejarlo disponible, el sistema revisa la cola de esa obra en esa sede y, si hay alguien, lo asigna a su reserva. |
| RN-12 | El tipo de lector define el **máximo de reservas activas** y los **días para recoger**. Un lector bloqueado (RN-03) no puede reservar. |
| RN-68 | Al **prestar** una obra a un lector, sus otras reservas vivas de esa obra se cancelan solas: en cola → `cancelada`; `asignada` en otra sede → `cancelada` y su ejemplar se libera para el siguiente de la cola (RN-11). No se puede reservar una obra que el lector ya tiene prestada. |
| RN-69 | **La cola manda**: si en una sede hay reservas en cola por una obra, ninguna copia de esa obra que quede libre en esa sede se presta a otro lector ni queda `disponible`; se asigna a la primera reserva (al devolver, RN-11; al ubicar, RN-20; al vencer otra reserva, RN-48). En mostrador, una copia disponible con cola solo se presta al primero de la cola, y su reserva queda cumplida. |
| RN-72 | Para **reservar** hace falta la cuenta **verificada** (no hace falta validarla, D-02, RN-32), no estar bloqueado (RN-43), tener cupo de reservas físicas (RN-12, RN-45; cuentan las `activa` y `asignada`) y la edad de la clasificación (RN-46). La sede se elige libremente, aunque no tenga copias (genera traslados sugeridos, RN-14). |

## Sedes, devoluciones y traslados

| # | Regla |
|---|---|
| RN-13 | **Colección flotante**: un ejemplar se puede devolver en cualquier sede y pasa a pertenecer a esa sede. |
| RN-14 | El sistema **sugiere traslados** (calculado, no guardado) cuando una sede tiene lectores en cola por una obra y ninguna copia disponible, y otra sede tiene más copias disponibles que un mínimo configurable. |
| RN-15 | Un empleado **confirma, ajusta o descarta** cada traslado sugerido; nunca se mueven libros automáticamente. |
| RN-16 | Un traslado confirmado **se guarda** con su ciclo `pendiente` → `en_transito` → `recibido` (o `cancelado` antes del despacho). Detalle en RN-50 a RN-52. |

## Ubicación física y ejemplares

| # | Regla |
|---|---|
| RN-17 | La ubicación es **jerárquica**: sección → pasillo → estante → nivel (ej. "Literatura (azul) – Pasillo B – Estante 3.5"). El ejemplar apunta a una ubicación de un **catálogo de ubicaciones válidas** de su sede; nunca se escribe a mano. |
| RN-18 | Las **secciones y su color son de toda la red** (un solo código de colores para el lector). Cada sede decide qué pasillos y estantes asigna a cada sección. |
| RN-19 | Cada sección agrupa uno o varios **géneros**. Cada libro tiene un **género principal**, que decide su sección y su color, y puede tener **géneros secundarios** para búsqueda y filtros. |
| RN-20 | Un ejemplar que llega a una sede (por devolución en otra sede o por traslado) queda **por ubicar**: no cuenta como disponible ni se puede reservar hasta que un empleado confirma su estante. El sistema **sugiere** un estante de la sección de su género principal en esa sede. |
| RN-21 | **Auditoría de estante**: un empleado registra los códigos que encuentra en un estante y el sistema los compara con lo esperado. La fecha de la última verificación de un estante se **calcula** (última auditoría cerrada). Detalle en RN-53. |
| RN-22 | Estados del ejemplar: `disponible`, `apartado`, `prestado`, `por_ubicar`, `en_transito`, `en_reparacion`, `perdido`, `de_baja`. |
| RN-23 | El estado del ejemplar **se guarda** (desnormalización controlada, por ser la consulta más frecuente del sistema). Toda operación que lo afecta (prestar, devolver, asignar reserva, trasladar, ubicar) lo actualiza **en la misma transacción** que su registro, con `UPDATE ... WHERE estado = <estado esperado>` como candado de concurrencia. |
| RN-24 | Una **consulta detectora** compara el estado guardado con el deducido de préstamos, reservas, traslados y ubicación. Debe devolver 0 filas; se ejecuta en las pruebas y se muestra en el panel de administración. |

## Préstamo digital

| # | Regla |
|---|---|
| RN-25 | Las **licencias digitales son de la red**, no de una sede. La biblioteca adquiere N licencias de un título (N lecturas simultáneas), con **fecha de vencimiento opcional**; al vencer dejan de contar. |
| RN-26 | El tipo de lector define los **días de préstamo digital** y el **máximo de préstamos digitales simultáneos**, independientes de los físicos. |
| RN-27 | El lector puede **devolver antes** para liberar la licencia. Al cumplirse el plazo, el préstamo **vence solo**: vigente = no devuelto y fecha de fin posterior a ahora (se calcula, no requiere proceso programado). |
| RN-28 | La **reserva digital** es sobre la obra, sin sede, en cola por orden de llegada. Al liberarse una licencia se asigna al primero, que tiene un plazo en horas para **confirmar**; si no confirma, pasa al siguiente. |
| RN-29 | La lectura es **solo en la web, con la sesión del lector**: un visor propio dibuja las páginas (pdf.js) sin opción de descargar ni imprimir. El archivo vive fuera de `public/` y lo entrega una ruta que verifica en el servidor la sesión y un préstamo vigente o una compra del título; responde solo a las peticiones del visor (no al abrir la URL directamente) y con `Cache-Control: no-store`. Límite asumido: lo que el navegador muestra se puede capturar; la regla garantiza que la web no ofrece descarga y que solo lo recibe quien tiene acceso. |
| RN-30 | La **compra digital** da acceso de lectura permanente al título, sin consumir licencias de préstamo. |

## Cuentas, empleados y roles

| # | Regla |
|---|---|
| RN-31 | Una **cuenta** (correo único, hash de contraseña, estado RN-01) representa a la persona. Los **perfiles** lector y empleado apuntan a la cuenta; una persona puede tener ambos con un solo inicio de sesión. |
| RN-32 | Al registrarse se envía un **enlace de verificación** con token de un solo uso que vence. Sin verificar el correo no se usan los beneficios. En desarrollo, el enlace se imprime en la consola. |
| RN-70 | **Registro**: correo, contraseña (mínimo 12 caracteres), nombre, apellido, fecha de nacimiento y los datos de RN-74. Crea la cuenta y el perfil de lector con el tipo de lector inicial de la configuración; el token de verificación vence en `horas_verificacion_correo`. Mientras no haya un proveedor de correo, "enviar" el correo es escribir el enlace en la consola del servidor. La **validación en mostrador** (D-03) exige la cuenta verificada; el empleado **coteja** el documento registrado con el original (y lo corrige si no coincide) y puede cambiar el tipo de lector. |
| RN-33 | Roles de empleado: **bibliotecario** (préstamos, devoluciones, ubicar ejemplares, validar lectores, entregar pedidos), **coordinador de sede** (lo anterior + traslados, auditorías de estante y reportes de su sede) y **administrador de red** (catálogo, licencias, precios, secciones, tipos de lector, configuración y empleados). |
| RN-34 | Bibliotecario y coordinador tienen **una sede asignada** y solo operan en ella; cada operación registra el empleado y la sede. El administrador de red no tiene sede y ve todas. |
| RN-35 | Los permisos se verifican **en el servidor** en cada operación; ocultar un botón en la interfaz no es una medida de seguridad. |
| RN-62 | Las contraseñas se guardan con **scrypt** (sal aleatoria por contraseña); junto al hash se guardan sus parámetros, para poder endurecerlos después sin invalidar las contraseñas existentes. |
| RN-63 | **Sesión en base de datos**: al iniciar sesión se genera un token aleatorio; la cookie lleva el token y la BD guarda solo su hash, con vencimiento de `horas_sesion` (configuración). La cookie es `httpOnly`, `sameSite=lax` y `secure` en producción. |
| RN-64 | Una sesión vale si existe, no venció y la cuenta no está desactivada; para el panel, además, el perfil de empleado debe estar activo. Se verifica en el servidor en cada petición (RN-35). Cerrar sesión borra la fila; desactivar una cuenta o un empleado deja fuera a sus sesiones en la siguiente petición. |
| RN-73 | **Límite de intentos**: cada inicio de sesión y cada registro se anota con correo, IP, resultado y fecha. Se rechaza, **sin verificar la contraseña**, un inicio de sesión con más de `max_fallos_por_correo` fallos para ese correo, o más de `max_fallos_por_ip` desde esa IP, dentro de los últimos `minutos_ventana_intentos` (los fallos de un correo anteriores a su último acceso correcto no cuentan). Un registro se rechaza con más de `max_registros_por_ip` desde la misma IP en la ventana. El mensaje no dice si el correo existe. |
| RN-74 | **Datos obligatorios del lector** desde el registro: documento (tipo y número, único en la red), teléfono, dirección (calle y ciudad; el código postal es opcional) y fecha de nacimiento. Sirven para verificar la edad (RN-46), comprobar en mostrador que es una persona real (D-03) y ubicarla si no devuelve un libro o lo pierde (RN-49). El tipo de documento debe ser coherente con la edad: **CC solo desde los 18 años y TI solo antes** (CE y pasaporte, a cualquier edad). Un documento ya registrado recibe la misma respuesta que un correo ya registrado (RN-70) y se avisa al dueño de esa cuenta, para que el registro no revele qué documentos tienen cuenta. |
| RN-77 | **Datos que cambia el propio lector** desde su cuenta: teléfono, dirección (calle, código postal y ciudad) y preferencias (tema y avatar, RN-81). Se validan igual que en el registro (RN-74). Nombre, apellido, fecha de nacimiento y documento **solo los cambia un empleado en el mostrador**, con el documento original a la vista (D-03, RN-70): son los datos que se verificaron, y la fecha de nacimiento decide la edad (RN-46) y el tipo de documento válido (RN-74). Los datos del perfil de empleado (nombre, rol y sede) los cambia el administrador de red (RN-33). El correo y la contraseña de la cuenta los cambia su dueño (RN-78, RN-79). |
| RN-78 | **Cambiar la contraseña** desde la sesión exige la contraseña actual. La nueva cumple el mínimo de RN-70 y se guarda según RN-62. Al cambiarla se cierran **las demás sesiones** de la cuenta; la actual sigue abierta. Un fallo con la contraseña actual cuenta como fallo de inicio de sesión para RN-73: así, alguien que encuentre una sesión ajena abierta no puede probar contraseñas sin límite. |
| RN-79 | **Cambiar el correo** exige la contraseña actual (cuenta para RN-73 como en RN-78) y se confirma con un enlace de un solo uso enviado **al correo nuevo**, guardado como hash y con el vencimiento de RN-70. Hasta confirmarlo, la cuenta sigue con el correo anterior; al confirmarlo se avisa al correo anterior. Si el correo nuevo ya tiene cuenta, la respuesta es la misma que si no la tuviera (como RN-70) y el cambio no se hace; al confirmar se comprueba otra vez que sigue libre. |
| RN-80 | **Recuperar la contraseña**: se pide el correo y la respuesta es **siempre la misma**, exista o no la cuenta. Si existe y no está desactivada, se envía un enlace de un solo uso (token `recuperar_contrasena`, guardado como hash, RN-32) que vence en `minutos_recuperacion_contrasena`. Pedir un enlace nuevo anula los anteriores sin usar. Abrir el enlace no cambia nada (como la verificación del correo): la contraseña nueva se envía con un formulario. Al cambiarla se cierran **todas** las sesiones de la cuenta. Las solicitudes se anotan en la bitácora de RN-73 y se limitan por correo y por IP con los mismos topes. |
| RN-81 | **Avatar generado**: toda cuenta tiene avatar. Al crearla (registro o alta de un empleado), el sistema le asigna uno **genérico al azar**: un estilo de la lista permitida y una semilla aleatoria, dibujados en el servidor con DiceBear, sin enviar datos a servicios externos. La semilla no sale del correo ni del id, así que el avatar no revela nada de la persona. Su dueño puede generar otro, elegir otro estilo, subir una foto (RN-82) y volver al generado cuando quiera. Solo se usan estilos con licencia **CC0**, que no exige atribución. |
| RN-82 | **Foto de avatar**: JPEG, PNG o WebP de hasta `max_kb_avatar` KB. **No se acepta SVG**, porque puede traer scripts. El tipo se comprueba por el contenido del archivo, no por la extensión ni por lo que diga el navegador. El servidor la recorta cuadrada y la **vuelve a codificar** (WebP de 256 px), y así elimina los metadatos (EXIF, que puede traer la ubicación GPS). Se guarda fuera de `public/` con un nombre aleatorio, y la entrega una ruta que exige sesión: la ven su dueño y los empleados. Una foto nueva reemplaza a la anterior, que se borra. Un empleado puede **retirar** una foto inapropiada y la cuenta vuelve a su avatar generado. |
| RN-83 | **Volver a donde estaba**: cuando una página exige iniciar sesión, el login recibe la ruta de origen (`?siguiente=`) y vuelve a ella al entrar. Solo se aceptan rutas internas: empiezan por `/`, pero no por `//` ni por `/\`. Cualquier otro valor se ignora y se usa el destino por perfil (panel o cuenta), para que el login no sirva para redirigir a otro sitio (*open redirect*). La ruta además se interpreta como URL contra el propio sitio y la misma regla se aplica al resultado: el navegador borra tabuladores y saltos de línea (`/␉/otro.com` → `//otro.com`) y los `..` se resuelven (`/..//otro.com` → `//otro.com`). La acción de login la vuelve a validar aunque la página ya lo hizo. |

## Compras

| # | Regla |
|---|---|
| RN-36 | El **stock de venta** es una cantidad por título y sede, separado de los ejemplares de préstamo. |
| RN-37 | El stock se **aparta al crear el pedido** (`UPDATE ... WHERE cantidad >= ?` como candado de concurrencia). Si el pedido no se paga en el plazo configurado, **vence** y el stock vuelve. |
| RN-38 | Un pedido físico sale de **una sola sede**: la elegida para recoger, o, para envío, una sede con stock de todo el carrito. Si ninguna lo tiene, el comprador divide la compra. |
| RN-39 | El detalle del pedido **guarda el precio del momento** de la compra; cambiar el precio de un título no altera pedidos anteriores. |
| RN-40 | Ciclo del pedido: `pendiente_pago` → `pagado` → `preparado` → `listo_para_recoger` o `enviado` → `entregado`. También `vencido` (RN-37), `cancelado` (antes de entregarse) y `reembolsado`. Los ítems digitales se entregan al pagar. |
| RN-41 | Un libro físico comprado se puede **devolver dentro de N días** en cualquier sede: reembolso (simulado) y el stock vuelve a la sede que lo recibe. Las compras digitales **no son reembolsables** una vez abiertas. |
| RN-42 | El envío a domicilio se cobra con una **tarifa por ciudad** de destino, con un monto opcional a partir del cual es gratis. Solo se envía a ciudades con tarifa. |

## Convenciones del modelo de datos

| # | Convención |
|---|---|
| C-01 | Nombres en `snake_case`, minúscula y singular (`lector`, `prestamo_fisico`, `libro_genero`); claves `id_<tabla>`. En MySQL sobre Linux los nombres de tabla distinguen mayúsculas. |
| C-02 | **Estados como ENUM** (ejemplar, reserva, préstamo digital, traslado, pedido, pago), porque cada valor tiene lógica en el código. **Catálogos editables en tablas** (género, sección, editorial, tipo de lector, ciudad, país), porque un administrador los amplía sin tocar código. |
| C-03 | `ciudad` en tabla (sedes, direcciones de envío, tarifas). `pais` en tabla, solo para la nacionalidad del autor. Calle y código postal como texto. |
| C-04 | Las reglas con valores (límites, plazos, montos) viven en **datos** (`tipo_lector` y una tabla de configuración), no en el código. |
| C-05 | Cambios respecto al modelo de BD2: `Biblioteca` → `sede`; `Usuario` → `cuenta` + `lector`; `Categoria` se descarta a favor de `genero` + `seccion`; los catálogos de estado pasan a ENUM; `Cargo` pasa a rol (ENUM); se agregan ubicación, traslado, préstamo y licencia digital, pedidos, pagos y stock. |

## Valores iniciales

Cargados en el seed; se cambian en datos sin tocar código (C-04).

| Valor | Inicial |
|---|---|
| Renovaciones máximas por préstamo | 2 |
| Multa por día de atraso / tope | $1.000 / $30.000 |
| Días de atraso para declarar un ejemplar perdido | 30 |
| Días para recoger una reserva física | 3 |
| Horas para confirmar una reserva digital | 48 |
| Minutos para pagar un pedido | 30 |
| Días para devolver una compra física | 15 |
| Mínimo de copias disponibles de sobra para sugerir un traslado (RN-14) | 1 |
| Horas que dura una sesión (RN-63) | 8 |
| Horas para usar el enlace de verificación del correo (RN-70) | 24 |
| Tipo de lector al registrarse (RN-70) | Estándar |
| Fallos de inicio de sesión por correo / por IP, y registros por IP (RN-73) | 5 / 20 / 5 |
| Ventana de conteo de intentos (RN-73) | 15 minutos |
| Días antes del vencimiento para avisar "por vencer" (RN-76) | 3 |
| Minutos para usar el enlace de recuperación de contraseña (RN-80) | 60 |
| Tamaño máximo de la foto de avatar (RN-82) | 2048 KB (2 MB) |

## Reglas transversales

| # | Regla |
|---|---|
| RN-43 | Un lector **bloqueado** (RN-03) no puede pedir préstamos físicos ni digitales ni hacer reservas; **sí puede comprar**. |
| RN-44 | La fecha de fin de un préstamo digital es la **menor** entre la fecha de hoy más los días del tipo de lector y el vencimiento de la licencia (RN-25). |
| RN-45 | El tipo de lector define **máximos separados** de reservas físicas y de reservas digitales (complementa RN-12). |
| RN-46 | Cada libro tiene una **clasificación por edad** (infantil, +15, +18, en tabla). El lector registra su fecha de nacimiento y no puede prestar, reservar ni comprar títulos de una clasificación superior a su edad. La edad **se calcula**, no se guarda. |
| RN-47 | Un ejemplar devuelto **en su propia sede** vuelve a su estante y queda `disponible` (o se asigna a una reserva, RN-11) sin pasar por `por_ubicar`. Solo las llegadas desde otra sede quedan por ubicar (RN-20). |
| RN-48 | **Vencimiento perezoso**: antes de operar sobre una obra (y sede, si aplica) se procesan sus vencidos: reservas físicas no recogidas (RN-10), reservas digitales no confirmadas (RN-28) y pedidos no pagados (RN-37). Más adelante se puede sumar una tarea programada que barra todo periódicamente. |
| RN-49 | Un ejemplar se declara **perdido** por decisión de un empleado, a partir de una lista calculada de préstamos con más de `dias_atraso_perdido` días de atraso. Al declararlo, el ejemplar pasa a `perdido` y se genera la multa de reposición (RN-06). |
| RN-50 | Un traslado es un **envío por lote** entre dos sedes distintas: una cabecera (origen, destino, estado, fechas y empleados) con N ejemplares. |
| RN-51 | Confirmar un traslado **no bloquea** los ejemplares: siguen disponibles hasta el **despacho**. Al despachar, cada ejemplar pasa a `en_transito` con el candado `WHERE estado = 'disponible'`; el que ya no esté disponible queda `cancelado` dentro del lote. |
| RN-52 | Al **recibir** un traslado, cada ejemplar cambia de sede. Si en la sede destino hay cola por esa obra, se asigna directo a la primera reserva (`apartado`, sin ubicación, en mostrador); si no, queda `por_ubicar` (RN-20). |
| RN-53 | Una auditoría guarda las **lecturas tal cual**, incluidos códigos inexistentes. Al cerrarla, los hallazgos calculados se **congelan** como registro histórico: `faltante`, `mal_ubicado`, `estado_incoherente` (leído pero el sistema lo tiene prestado, en tránsito, etc.) y `desconocido`. El sistema sugiere correcciones (mal ubicado → actualizar ubicación; faltante → declarar perdido) y el empleado aplica o descarta cada una. |
| RN-54 | Las licencias se adquieren **por lotes de un título** (cantidad, fecha de adquisición, vencimiento opcional). Los archivos son **ediciones** del título por formato (`pdf`, `epub`); la primera versión implementa solo el visor PDF. |
| RN-55 | Al prestar, se asigna el lote que **vence antes entre los que cubren el préstamo completo**. Si ninguno lo cubre, el que vence más tarde (y el préstamo se recorta según RN-44). |
| RN-56 | Licencias **en uso** de un lote = préstamos vigentes + reservas digitales `asignadas` dentro de su plazo de confirmación (la reserva asignada retiene la licencia). La asignación se hace bloqueando los lotes del título (`SELECT ... FOR UPDATE`) mientras se cuenta. |
| RN-57 | El **carrito** se guarda en la base de datos por lector (se ve igual en cualquier dispositivo). Agregar al carrito **no aparta stock**; al crear el pedido se revalidan precio, stock y reglas. |
| RN-58 | Modalidad del pedido: `recoger`, `envio` o `solo_digital`. El pedido **congela** el precio de cada ítem (RN-39), la dirección de envío y el costo del envío; subtotal y total **se calculan** del detalle. `cancelado` = cancelado antes de pagar; `reembolsado` = pagado y cancelado antes de la entrega (reembolso total, el stock vuelve). |
| RN-59 | Un pedido puede tener **varios intentos de pago**, pero solo uno `pagado`. Cada pago guarda una referencia externa opcional para la futura pasarela (D-07). |
| RN-60 | Las **devoluciones de compras físicas son por ítem** y pueden ser parciales, dentro de `dias_devolucion_compra` desde la entrega. Registran cantidad, sede que recibe, empleado y monto reembolsado; el stock vuelve a la sede que recibe (RN-41). El pedido sigue `entregado`. |
| RN-61 | Pagar un ítem digital crea un **acceso permanente** (RN-30), único por lector y título: no se puede comprar dos veces. "Abierto" (RN-41) = tiene fecha de primera lectura. |

## Pendiente de definir

Las dudas que aparezcan al modelar las tablas se agregan aquí.

**Administración de la red** (fase propia después de la Fase 6; RN-33 ya dice quién la hace). Antes de diseñarla hay
que decidir:

- **Empleados:** el alta (¿crea la cuenta o se asocia a una que ya existe, RN-31?), el cambio de rol o de sede
  (¿qué pasa con sus operaciones abiertas?) y la desactivación. ¿Un administrador puede desactivarse a sí mismo? ¿Qué
  impide quedarse sin ningún administrador activo?
- **Catálogo:** alta y edición de libros, autores, editoriales y géneros. ¿Un libro con ejemplares o préstamos se puede
  borrar, o solo dar de baja?
- **Tipos de lector y configuración:** ¿cambiar un límite o un plazo afecta a los préstamos ya abiertos o solo a los
  nuevos? ¿Se registra quién cambió qué y cuándo?
- **Lectores:** desactivar una cuenta de lector (RN-64) y quién puede hacerlo.
