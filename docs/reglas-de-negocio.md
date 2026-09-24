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
| RN-01 | El estado de la cuenta **se guarda** (es una decisión o un hecho, no se deduce): `registrada` → `verificada` (confirmó su correo, RN-32) → `validada` (validada en mostrador, D-03); `desactivada` en cualquier momento. |
| RN-02 | Cada lector tiene un **tipo de lector**. El tipo define el máximo de préstamos físicos simultáneos y los días de préstamo (configurables en datos, no en código). |
| RN-03 | Un lector está **bloqueado para préstamos** mientras tenga multas pendientes o algún préstamo vencido. El bloqueo **se calcula**, no se guarda: al pagar o devolver se desbloquea solo. |

## Préstamos físicos

| # | Regla |
|---|---|
| RN-04 | Un préstamo se puede **renovar** hasta un número máximo de veces, solo si no está vencido y nadie tiene una reserva activa sobre esa obra. |
| RN-05 | La **multa por retraso** es un valor por día con un tope máximo. Se genera al devolver el libro. |
| RN-06 | Si un ejemplar no se devuelve (perdido), se cobra su **valor de reposición**. |

## Reservas físicas

| # | Regla |
|---|---|
| RN-07 | Una reserva es sobre **una obra en una sede** elegida por el lector, no sobre un ejemplar concreto. Solo cuentan las copias de esa sede; el sistema no traslada libros por una reserva. |
| RN-08 | El catálogo muestra la **disponibilidad por sede**, para que el lector decida dónde reservar o hacer cola. |
| RN-09 | Si hay copia disponible en la sede elegida, la reserva se **asigna de inmediato** (apartado). Si no, el lector entra en **cola** por orden de llegada. |
| RN-10 | Ciclo de la reserva: `activa` (en cola) → `asignada` (ejemplar apartado, lista para recoger) → `cumplida` al recogerla. Si no la recoge en el plazo, pasa a `vencida` y la copia se asigna al siguiente de la cola. El lector puede `cancelar` antes de recoger. |
| RN-11 | Al **devolver** un ejemplar, antes de dejarlo disponible, el sistema revisa la cola de esa obra en esa sede y, si hay alguien, lo asigna a su reserva. |
| RN-12 | El tipo de lector define el **máximo de reservas activas** y los **días para recoger**. Un lector bloqueado (RN-03) no puede reservar. |

## Sedes, devoluciones y traslados

| # | Regla |
|---|---|
| RN-13 | **Colección flotante**: un ejemplar se puede devolver en cualquier sede y pasa a pertenecer a esa sede. |
| RN-14 | El sistema **sugiere traslados** (calculado, no guardado) cuando una sede tiene lectores en cola por una obra y ninguna copia disponible, y otra sede tiene más copias disponibles que un mínimo configurable. |
| RN-15 | Un empleado **confirma, ajusta o descarta** cada traslado sugerido; nunca se mueven libros automáticamente. |
| RN-16 | Ciclo del traslado (se guarda): `pendiente` → `en tránsito` → `recibido`. Al recibirlo, el ejemplar cambia de sede. |

## Ubicación física y ejemplares

| # | Regla |
|---|---|
| RN-17 | La ubicación es **jerárquica**: sección → pasillo → estante → nivel (ej. "Literatura (azul) – Pasillo B – Estante 3.5"). El ejemplar apunta a una ubicación de un **catálogo de ubicaciones válidas** de su sede; nunca se escribe a mano. |
| RN-18 | Las **secciones y su color son de toda la red** (un solo código de colores para el lector). Cada sede decide qué pasillos y estantes asigna a cada sección. |
| RN-19 | Cada sección agrupa uno o varios **géneros**. Cada libro tiene un **género principal**, que decide su sección y su color, y puede tener **géneros secundarios** para búsqueda y filtros. |
| RN-20 | Un ejemplar que llega a una sede (por devolución en otra sede o por traslado) queda **por ubicar**: no cuenta como disponible ni se puede reservar hasta que un empleado confirma su estante. El sistema **sugiere** un estante de la sección de su género principal en esa sede. |
| RN-21 | **Auditoría de estante**: un empleado registra los códigos que encuentra en un estante y el sistema los compara con lo esperado (faltantes, sobrantes, mal ubicados). Se guarda la fecha de la última verificación de cada estante. |
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
| RN-29 | La lectura es **solo en el navegador**. El archivo se sirve por una ruta que verifica en el servidor que el lector tiene un préstamo vigente o una compra de ese título; nunca por una URL pública ni como descarga. |
| RN-30 | La **compra digital** da acceso de lectura permanente al título, sin consumir licencias de préstamo. |

## Cuentas, empleados y roles

| # | Regla |
|---|---|
| RN-31 | Una **cuenta** (correo único, hash de contraseña, estado RN-01) representa a la persona. Los **perfiles** lector y empleado apuntan a la cuenta; una persona puede tener ambos con un solo inicio de sesión. |
| RN-32 | Al registrarse se envía un **enlace de verificación** con token de un solo uso que vence. Sin verificar el correo no se usan los beneficios. En desarrollo, el enlace se imprime en la consola. |
| RN-33 | Roles de empleado: **bibliotecario** (préstamos, devoluciones, ubicar ejemplares, validar lectores, entregar pedidos), **coordinador de sede** (lo anterior + traslados, auditorías de estante y reportes de su sede) y **administrador de red** (catálogo, licencias, precios, secciones, tipos de lector, configuración y empleados). |
| RN-34 | Bibliotecario y coordinador tienen **una sede asignada** y solo operan en ella; cada operación registra el empleado y la sede. El administrador de red no tiene sede y ve todas. |
| RN-35 | Los permisos se verifican **en el servidor** en cada operación; ocultar un botón en la interfaz no es una medida de seguridad. |

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
| C-02 | **Estados como ENUM** (ejemplar, reserva, préstamo digital, traslado, pedido, pago, cuenta), porque cada valor tiene lógica en el código. **Catálogos editables en tablas** (género, sección, editorial, tipo de lector, ciudad, país), porque un administrador los amplía sin tocar código. |
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

## Reglas transversales

| # | Regla |
|---|---|
| RN-43 | Un lector **bloqueado** (RN-03) no puede pedir préstamos físicos ni digitales ni hacer reservas; **sí puede comprar**. |
| RN-44 | La fecha de fin de un préstamo digital es la **menor** entre la fecha de hoy más los días del tipo de lector y el vencimiento de la licencia (RN-25). |
| RN-45 | El tipo de lector define **máximos separados** de reservas físicas y de reservas digitales (complementa RN-12). |
| RN-46 | Cada libro tiene una **clasificación por edad** (infantil, +15, +18, en tabla). El lector registra su fecha de nacimiento y no puede prestar, reservar ni comprar títulos de una clasificación superior a su edad. La edad **se calcula**, no se guarda. |
| RN-47 | Un ejemplar devuelto **en su propia sede** vuelve a su estante y queda `disponible` (o se asigna a una reserva, RN-11) sin pasar por `por_ubicar`. Solo las llegadas desde otra sede quedan por ubicar (RN-20). |

## Pendiente de definir

Nada por ahora. Las dudas que aparezcan al modelar las tablas se agregan aquí.
