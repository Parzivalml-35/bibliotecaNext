# Auditoría UX — 2026-10-27

> Foto del estado de la interfaz al empezar la Fase R (rama `feat/rediseno`, después de R1). El objetivo de cómo
> debe quedar está en `docs/diseno.md` (DI-10 a DI-12); las reglas nuevas, en `docs/reglas-de-negocio.md`
> (RN-76 a RN-83). Este documento no se actualiza: cuando los hallazgos se resuelvan, se marcan en `docs/estado.md`.

## Cómo se hizo

Revisión del código, no prueba en el navegador con cada rol: `app/layout.tsx`, `components/menu-usuario.tsx`,
`app/panel/layout.tsx`, `lib/sesion.ts`, `lib/actions/sesion.ts` y las 16 páginas de `app/`. Para cada página se
anotó quién puede entrar (`exigirEmpleado(roles)` o `exigirLector()`) y se comparó con lo que muestra la navegación.

Para repetirla: `grep -rn "exigirEmpleado(\|exigirLector(" app` y compararlo con los `<Link>` de los layouts y del menú.

## Inventario actual

| Ruta | Quién entra (verificado en el servidor) | Cómo se llega |
|---|---|---|
| `/` | Cualquiera | Logo |
| `/libros/[isbn]` | Cualquiera | Tarjeta del catálogo |
| `/login`, `/registro`, `/verificar` | Cualquiera (un empleado conectado que entra a `/login` va a `/panel`) | Menú de usuario, enlaces |
| `/cuenta` | Perfil de lector | "Mi cuenta" en el menú |
| `/cuenta/pago/[id]` | El lector dueño del pago | Botón "Pagar en línea" |
| `/leer/[isbn]` | Lector con préstamo vigente o compra | Botón "Leer" |
| `/panel` | Cualquier empleado | "Panel" en el menú |
| `/panel/prestamos`, `/devoluciones`, `/ubicar`, `/perdidos` | Bibliotecario y coordinador | Menú del panel (lo ven **todos**) |
| `/panel/lectores` | Cualquier empleado | Menú del panel |
| `/panel/tablero` | Coordinador y administrador | Menú del panel (lo ven **todos**) |
| `/panel/licencias` | Administrador | Menú del panel (lo ven **todos**) |

**Lo que está bien y se conserva:** cada página y cada acción verifica en el servidor (RN-35); el layout del panel no
lo intenta, a propósito (un layout no se vuelve a ejecutar al navegar). Los avisos de `?motivo=` usan claves con textos
fijos, nunca el texto de la URL. Salir es un POST. Hay esqueletos de carga y páginas de error y de "no encontrado".

## Hallazgos

| ID | Gravedad | Hallazgo | Se resuelve con |
|---|---|---|---|
| UX-01 | **Alta** | **El menú del panel es igual para todos los roles.** `app/panel/layout.tsx` muestra los 8 enlaces a cualquier empleado. El administrador ve 4 que no puede abrir (nuevo préstamo, devolución, ubicar, perdidos), el bibliotecario 2 (tablero, licencias) y el coordinador 1 (licencias). Al hacer clic, la página lo devuelve a `/panel?motivo=sin-permiso`. **No es un hueco de seguridad** (cada página verifica), pero la persona no puede saber qué le corresponde | DI-10, DI-11 (R3) |
| UX-02 | **Alta** (causa de UX-01) | **Dos fuentes de verdad para los permisos**: los enlaces del layout y los `exigirEmpleado([...])` de cada página se escribieron por separado. Cualquier página nueva puede repetir el error | DI-11: `lib/permisos.ts` (R3) |
| UX-03 | Media | **Panel sin agrupar**: 8 enlaces seguidos, sin relación con el trabajo de cada rol. En pantallas estrechas, `flex-wrap` los reparte en varias líneas. Con traslados, auditorías, pedidos y administración pasarían de 15 | Secciones Mostrador, Lectores, Colección, Reportes y Red (R3) |
| UX-04 | Media | **`/cuenta` lo concentra todo**: resumen, préstamos, reservas, multas y digitales en una sola página. Con perfil, seguridad y compras no cabría | Pestañas de "Mi cuenta" (R3, R5) |
| UX-05 | Media | **El login no devuelve a donde se estaba.** `exigirLector()` y `exigirEmpleado()` redirigen a `/login` sin la ruta de origen, y al entrar se va al panel o a la cuenta. Quien quería reservar desde la ficha de un libro pierde el contexto | RN-83 (R3) |
| UX-06 | Media | **La cuenta no se puede administrar**: no hay cómo cambiar datos, contraseña ni correo, ni recuperar la contraseña. El esquema ya previó un token `recuperar_contrasena` sin regla ni código | RN-77 a RN-80 (R7) |
| UX-07 | Baja | **El administrador aterriza en "Préstamos abiertos"** de toda la red, que no puede renovar: no es su trabajo diario | `/panel` redirige por rol; el admin va a Reportes (R3) |
| UX-08 | Baja | **Menú de usuario** hecho de enlaces de texto sueltos, sin avatar; en el celular se oculta el nombre y "Salir" queda junto a los demás enlaces | Menú desplegable con avatar (DI-12, R3 y R7) |
| UX-09 | Baja | **El visor no es inmersivo**: `/leer/[isbn]` se dibuja dentro de la barra general de la app | Layout propio del visor (R5) |
| UX-10 | Baja | **Colores escritos a mano** (`zinc-*`, `amber-*`) en 35 archivos, sin tokens ni significado común; los avisos usan ámbar en unas pantallas y texto gris en otras | Tokens y colores de estado (R2, R5) |
| UX-11 | Baja | **Estados vacíos sin siguiente paso**: textos como "Sin préstamos ni reservas digitales." no ofrecen qué hacer | Estados comunes de `diseno.md` (R4, R5) |
| UX-12 | Temporal | Desde R1, el modo oscuro automático no funciona: `dark:` espera la clase `.dark` | Temas con cookie (R2) |
