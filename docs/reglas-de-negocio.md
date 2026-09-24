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
| RN-01 | El estado de la cuenta (registrada, validada, desactivada) **se guarda**: es una decisión, no se deduce de otros datos. |
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

## Pendiente de definir

- Número máximo de renovaciones, valor por día y tope de la multa, plazo para declarar un ejemplar perdido.
- Préstamo digital: duración, licencias por título, reservas digitales.
- Empleados: roles, permisos y si trabajan en una o en varias sedes.
- Cuentas: si lectores y empleados comparten tabla de autenticación.
- Compras: stock por sede, estados del pedido, devoluciones y reembolsos, precio de envío.
- Revisión de inconsistencias del modelo de BD2 (`Genero`/`Categoria`, `ciudad` en `Biblioteca`, catálogos de estado).
