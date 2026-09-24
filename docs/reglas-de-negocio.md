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

## Pendiente de definir

- Reservas físicas: ¿sobre la obra o sobre un ejemplar?, ¿en qué sede se recoge?, vencimiento y orden de la cola.
- Devolución en una sede distinta a la del préstamo.
- Número máximo de renovaciones, valor por día y tope de la multa, plazo para declarar un ejemplar perdido.
- Préstamo digital: duración, licencias por título, reservas digitales.
- Ubicación física: pasillo / estante / nivel, identificación por color, cambios de ubicación.
- Empleados: roles, permisos y si trabajan en una o en varias sedes.
- Cuentas: si lectores y empleados comparten tabla de autenticación.
- Compras: stock por sede, estados del pedido, devoluciones y reembolsos, precio de envío.
- Revisión de inconsistencias del modelo de BD2 (`Genero`/`Categoria`, `ciudad` en `Biblioteca`, catálogos de estado).
