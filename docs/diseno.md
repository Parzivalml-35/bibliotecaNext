# Ficha de diseño (Fase R)

> Fuente de verdad del aspecto visual: identidad, temas, tokens y decisiones de la interfaz. Igual que
> `reglas-de-negocio.md` para el comportamiento: si una pantalla necesita algo que no está aquí, se decide y se agrega.

## Referencias

Inspiración, no copia: no se usan imágenes, logos ni textos de las referencias.

| Referencia | Qué se toma |
|---|---|
| YowBooks (Dribbble) | Fondo gris muy claro con tarjetas blancas, acento naranja, portadas protagonistas, progreso de lectura |
| YowBooks "My Library" (captura 3) | **Lenguaje de bloques**: tarjetas con borde fino, barras de progreso con rayas, etiquetas de color, borde punteado para "agregar", bandeja gris para agrupar (DI-08) |
| "Books" (captura 4) | Estética de biblioteca: crema y beige, títulos con serif, acento dorado, **barra superior con pestañas en píldora** |

## Decisiones

| ID | Decisión | Por qué |
|---|---|---|
| DI-01 | Componentes con **shadcn/ui sobre Radix**, preset **Maia** (`"style": "radix-maia"`), con íconos **Hugeicons** | Radix: es la base de casi toda la documentación y los ejemplos de shadcn. Maia ("soft and rounded, with generous spacing"): el preset más cercano a YowBooks, con botones en píldora. El preset no se puede cambiar después del `init` |
| DI-02 | Navegación con **barra superior** (pestañas en píldora y menú de usuario a la derecha), sin sidebar | Estilo "Books". En el celular, las pestañas pasan a un menú (`Sheet`) |
| DI-03 | Tres temas: **claro**, **oscuro** y **lámpara** (crema cálido). Botón de tres estados: sol, luna y lámpara | La lámpara es para leer con luz cálida |
| DI-04 | La preferencia de tema se guarda en una **cookie** (`tema`). La lee un **script en línea del `<head>`**, que pone `<html data-tema="…">` antes del primer pintado. **Sin cookie se sigue al sistema** (`prefers-color-scheme`: claro u oscuro; la lámpara solo si se elige). Si hay sesión, la preferencia también se guarda en la cuenta (R7) | Sin dependencias ni parpadeo. Leer la cookie con `cookies()` en el layout raíz volvería dinámica toda la app (guía "Preventing flash before hydration" de Next 16); el script mantiene el layout estático, igual que el `<Suspense>` del menú. Corregido el 2026-10-27: antes decía que el layout la leía en el servidor |
| DI-05 | Portadas **generadas** (título, autor y color derivado del ISBN) mientras no haya imagen real. Cuando exista, la imagen manda y la generada queda de respaldo. Color **igual en los tres temas**: `oklch(0.48 0.080 h)`, con `h` = FNV-1a del ISBN mod 360 (`lib/portada.ts`). Medido en los 360 tonos: cabe en sRGB y el texto blanco da 6.26:1 como mínimo (el autor, al 85 %, 5.02:1). Decidido en R4c | Es lo que hacen los sistemas grandes para los libros sin portada |
| DI-06 | Lector digital: **EPUB con foliate-js** como formato principal y **PDF como alternativa** (el visor actual con pdf.js se conserva). Preparado para cambiar a Readium (ver más abajo) | El EPUB se reacomoda a la pantalla y toma los colores del tema: es lo que hace posible leer en modo lámpara |
| DI-07 | Contraste mínimo **WCAG AA**: 4.5:1 para texto normal y 3:1 para texto grande e íconos, en los tres temas | Los acentos de las referencias no lo cumplen con texto blanco (ver "Acento y botón") |
| DI-08 | Interfaz hecha de **bloques con borde fino** (estilo captura 3), no de sombras. Ver "Lenguaje de bloques" | Los bordes funcionan igual en los tres temas; las sombras casi no se ven sobre fondo oscuro ni sobre beige |
| DI-09 | Cuatro **colores de estado** (`success`, `warning`, `danger`, `info`), cada uno con tres tonos por tema. El color nunca es la única señal: siempre va con texto | Las barras y etiquetas de colores de la captura 3 necesitan un significado y contraste en los tres temas |
| DI-10 | Tres **zonas** (pública, "Mi cuenta" y panel) con el mapa de rutas de abajo. El panel se divide en **secciones por tipo de trabajo**, y cada persona ve **solo las secciones y páginas que su rol puede usar** | Auditoría UX del 2026-10-27 (`docs/auditoria-ux.md`): hoy todos los roles ven los mismos 8 enlaces |
| DI-11 | **Una sola fuente de permisos**: `lib/permisos.ts` define **permisos con nombre** (`mostrador`, `coleccion`, `lectores`, `anularMultas`, `reportes`, `red`), cada uno con sus roles y la regla que lo justifica, y las secciones del panel con el permiso de cada página. Páginas y acciones piden un permiso (`exigirEmpleado("mostrador")`) y el menú muestra las páginas cuyo permiso tiene el rol. Ninguna lista ni comparación de roles se escribe fuera de ese archivo; el alcance por sede se decide con la sede (RN-34), no con el nombre del rol. Decidido el 2026-10-27: permisos con nombre en vez de un mapa de rutas, para que las acciones también lo usen | El problema de la auditoría nace de tener dos listas que se escribieron por separado: los enlaces del layout y los roles de cada página |
| DI-12 | **Avatar** en el menú de usuario: generado con DiceBear por defecto o foto propia (RN-81, RN-82). Si no carga, se muestran las iniciales | Da identidad a la cuenta y sirve de entrada al menú de usuario, como en las referencias |

## Arquitectura de información (DI-10)

Rutas **objetivo**. Las que cambian respecto de hoy se marcan como nuevas o movidas; el detalle de por qué está en
`docs/auditoria-ux.md`.

### Zona pública

| Ruta | Pantalla | Estado |
|---|---|---|
| `/` | Catálogo con búsqueda | Existe |
| `/libros/[isbn]` | Ficha del libro: dónde está, reservar, leer en línea | Existe |
| `/login` | Iniciar sesión. Acepta `?siguiente=` (RN-83) | Existe; `?siguiente=` es nuevo |
| `/registro`, `/verificar` | Crear cuenta y verificar el correo | Existen |
| `/recuperar` | Pedir el enlace y, con `?token=`, elegir la contraseña nueva (RN-80) | **Nueva** (R7) |

### "Mi cuenta" (cualquier cuenta con perfil de lector)

Una barra de pestañas propia, debajo de la barra superior.

| Ruta | Pestaña | Contenido | Estado |
|---|---|---|---|
| `/cuenta` | Resumen | Situación (bloqueos y motivos), lo que vence pronto (RN-76), avisos | Existe; se reparte |
| `/cuenta/prestamos` | Préstamos y reservas | Préstamos físicos (con renovaciones) y reservas físicas | **Nueva**: sale de `/cuenta` |
| `/cuenta/digitales` | Digitales | Préstamos y reservas digitales, botón "Leer" | **Nueva**: sale de `/cuenta` |
| `/cuenta/multas` | Multas | Multas y pago en línea | **Nueva**: sale de `/cuenta` |
| `/cuenta/pago/[id]` | (sin pestaña) | Pasarela simulada | Existe; se conserva |
| `/cuenta/perfil` | Perfil | Datos editables (RN-77), avatar (RN-81, RN-82), tema | **Nueva** (R7) |
| `/cuenta/seguridad` | Seguridad | Contraseña (RN-78) y correo (RN-79) | **Nueva** (R7) |
| `/leer/[isbn]` | (sin pestañas) | Visor **inmersivo**: barra mínima con volver, título y tema; sin la barra de la app | Hecho (R5d): fuera del route group `app/(sitio)` |

Un empleado sin perfil de lector no ve "Mi cuenta". El perfil, el avatar y la seguridad son de la **cuenta** (RN-31),
así que el empleado tiene su versión dentro del panel: `/panel/perfil`, con las mismas piezas.

### Panel (empleados)

Secciones por **tipo de trabajo**, como en los sistemas de bibliotecas (circulación, colección, administración).
La barra de pestañas del panel muestra solo las secciones del rol; dentro de cada sección, sus páginas.

| Sección | Ruta | Página | Bibliotecario | Coordinador | Admin de red | Estado |
|---|---|---|:-:|:-:|:-:|---|
| Mostrador | `/panel/mostrador` | Préstamos abiertos de la sede | ✓ | ✓ | | Movida desde `/panel` (R3b) |
| | `/panel/mostrador/prestamo` | Nuevo préstamo | ✓ | ✓ | | Movida (R3b) |
| | `/panel/mostrador/devolucion` | Devolución | ✓ | ✓ | | Movida (R3b) |
| | `/panel/mostrador/pedidos` | Entregar pedidos (RN-33) | ✓ | ✓ | | Fase 6 |
| Lectores | `/panel/lectores` | Buscar lector, validar, multas (anular según RN-67) | ✓ | ✓ | ✓ | Existe |
| Colección | `/panel/coleccion/ubicar` | Ubicar ejemplares | ✓ | ✓ | | Movida (R3b) |
| | `/panel/coleccion/perdidos` | Candidatos a perdido | ✓ | ✓ | | Movida (R3b) |
| | `/panel/coleccion/traslados` | Traslados (RN-50 a RN-52) | | ✓ | | Fase de traslados |
| | `/panel/coleccion/auditorias` | Auditorías de estante (RN-53) | | ✓ | | Fase de traslados |
| Reportes | `/panel/reportes` | Tablero: indicadores, traslados sugeridos, coherencia | | ✓ (su sede) | ✓ (la red) | Movida (R3b) |
| Red | `/panel/red/licencias` | Licencias digitales | | | ✓ | Movida (R3b) |
| | `/panel/red/catalogo` | Libros, autores, editoriales, ediciones digitales | | | ✓ | Fase de administración |
| | `/panel/red/empleados` | Empleados | | | ✓ | Fase de administración |
| | `/panel/red/tipos-lector`, `/panel/red/configuracion` | Tipos de lector y configuración | | | ✓ | Fase de administración |
| (sin sección) | `/panel/perfil` | Perfil, avatar, tema y seguridad del empleado | ✓ | ✓ | ✓ | **Nueva** (R7) |

**`/panel` deja de ser una página**: redirige a la primera sección del rol. El bibliotecario y el coordinador van a
Mostrador; el administrador, a Reportes. Una persona con los dos perfiles (RN-31) ve "Panel" y "Mi cuenta" en su menú.

Las URL cambian para que la ruta refleje la sección: la pestaña activa se calcula con el inicio de la ruta y cada
sección puede tener su propio `layout.tsx` con su sub-navegación. Ese layout **solo muestra**; la verificación sigue en
cada página y en cada acción (RN-35), porque un layout no se vuelve a ejecutar al navegar entre sus páginas.

### Navegación

| Pieza | Contenido | Dónde |
|---|---|---|
| Barra superior (todas las páginas, salvo el visor) | Logo · pestañas en píldora: **Catálogo**, **Mi cuenta** (si es lector), **Panel** (si es empleado) · botón de tema · menú de usuario | `app/(sitio)/layout.tsx` (R5d: route group) |
| Menú de usuario (sin sesión) | "Iniciar sesión" y "Crear cuenta" | Barra superior |
| Menú de usuario (con sesión) | Avatar (DI-12) que abre un menú: nombre y correo, Mi cuenta / Panel, Perfil, Seguridad, Salir | Barra superior (`DropdownMenu`) |
| Sub-navegación | Pestañas de "Mi cuenta" o secciones del panel del rol | Layout de la zona |
| En el celular | Las pestañas de la barra superior pasan a un menú lateral (`Sheet`); las sub-navegaciones se desplazan en horizontal | — |

### Estados comunes

Cada pantalla resuelve los mismos casos con las mismas piezas:

| Caso | Cómo se ve |
|---|---|
| Cargando | Esqueletos con la forma del contenido (ya existen en `components/esqueletos.tsx`) |
| Vacío | Bloque con borde punteado, una frase que explica y la acción siguiente ("Aún no tienes préstamos. Busca un libro") |
| Error de una acción | Mensaje junto al formulario, con `danger` y texto (no solo color) |
| Sin permiso | No debería verse: el menú no muestra lo que el rol no usa. Si se entra por URL, se redirige a la sección del rol con un aviso |
| Sin sesión | Redirige a `/login?siguiente=<ruta>` (RN-83) |

## Temas y tokens

Los nombres son los tokens semánticos de shadcn (`--background`, `--primary`…). Un tema es solo un bloque de
variables bajo un selector: `:root` (claro), `[data-tema="oscuro"]` y `[data-tema="lampara"]`. Ningún componente
sabe qué tema está activo.

Valores **propuestos**, a ajustar en R2 viéndolos en pantalla. Medidos con el algoritmo de contraste de WCAG 2.

En `globals.css` cada tema define solo sus colores base y de estado. Los derivados se escriben una vez en `:root`
y apuntan a la base: `card-foreground`, `popover` y `popover-foreground`, `secondary` (= `muted`), `input`
(= `border`), `ring` (= `primary`), `destructive` (= `danger`), los `chart-*` y los `sidebar-*`. Tokens propios
del proyecto: `decorativo` (el acento sin texto) y `success|warning|danger|info` con `-suave` y `-texto`, que se usan
como clases (`bg-success-suave text-success-texto`). Cada tema fija también `color-scheme`, para que las barras de
desplazamiento y los controles nativos sigan el tema.

| Token añadido en R2 | Claro | Lámpara | Oscuro | Contraste |
|---|---|---|---|---|
| `muted` (bandeja) | `#EEEBE8` | `#EEE0C8` | `#2A2522` | `muted-foreground` encima: 4.96 · 4.55 · 5.89 |
| `accent-foreground` | `#8A420A` | `#3B2A1A` | `#F5C08F` | Sobre `accent`: 6.51 · 9.64 · 8.38 |
| `decorativo` | `#E68124` | `#D9AB61` | `#F0923A` | Sin texto encima |

### Claro

| Token | Hex | oklch | Uso |
|---|---|---|---|
| `background` | `#F6F6F6` | `oklch(0.973 0 0)` | Fondo de la página |
| `card` | `#FFFFFF` | `oklch(1 0 0)` | Tarjetas, barra superior |
| `foreground` | `#1F1A17` | `oklch(0.223 0.010 53.0)` | Texto (15.95:1 sobre el fondo) |
| `muted-foreground` | `#6B635C` | `oklch(0.505 0.015 63.7)` | Texto secundario (5.45:1) |
| `primary` | `#B4570B` | `oklch(0.562 0.142 51.0)` | Botones y enlaces (texto blanco 4.87:1) |
| `accent` | `#FDEFE4` | `oklch(0.960 0.021 60.7)` | Fondo de la pestaña activa, *hover* |
| `border` | `#E7E2DD` | `oklch(0.915 0.009 67.7)` | Bordes |

### Lámpara

| Token | Hex | oklch | Uso |
|---|---|---|---|
| `background` | `#F2E5D0` | `oklch(0.927 0.031 79.9)` | Fondo beige |
| `card` | `#F9F3EE` | `oklch(0.967 0.009 62.6)` | Tarjetas crema |
| `foreground` | `#3B2A1A` | `oklch(0.301 0.037 64.0)` | Texto café (11.03:1) |
| `muted-foreground` | `#76604A` | `oklch(0.505 0.044 66.6)` | Texto secundario (4.77:1) |
| `primary` | `#8A5A12` | `oklch(0.509 0.103 70.8)` | Botones (texto crema 5.60:1) |
| `accent` | `#EAD6B3` | `oklch(0.884 0.051 81.6)` | Pestaña activa |
| `border` | `#E0CDAE` | `oklch(0.856 0.047 80.0)` | Bordes |

### Oscuro

Oscuro cálido (gris con un toque café), no negro azulado: conserva la familia de color de los otros dos.

| Token | Hex | oklch | Uso |
|---|---|---|---|
| `background` | `#171412` | `oklch(0.194 0.006 56.0)` | Fondo |
| `card` | `#211D1A` | `oklch(0.234 0.008 59.2)` | Tarjetas |
| `foreground` | `#F1ECE7` | `oklch(0.946 0.009 67.7)` | Texto (15.62:1) |
| `muted-foreground` | `#A8A09A` | `oklch(0.711 0.013 59.5)` | Texto secundario (7.13:1) |
| `primary` | `#F0923A` | `oklch(0.744 0.150 59.6)` | Botones (texto oscuro 7.74:1) |
| `accent` | `#3A2A1E` | `oklch(0.300 0.031 58.1)` | Pestaña activa |
| `border` | `#36302B` | `oklch(0.314 0.012 62.2)` | Bordes |

### Acento y botón

El naranja de YowBooks (`#E68124`) con texto blanco da 2.79:1, y el dorado de "Books" (`#D9AB61`) da 2.11:1: ninguno
sirve para un botón con texto. Por eso cada tema tiene dos tonos:

- `primary`: la versión oscurecida, para botones y enlaces (cumple AA).
- Acento decorativo (`#E68124` en claro, `#D9AB61` en lámpara): solo para elementos sin texto, como barras de
  progreso, íconos grandes o el subrayado de la pestaña activa. Si lleva información, se acompaña de texto.

## Colores de estado (DI-09)

Cada estado tiene tres tonos, porque cumplen funciones distintas con mínimos distintos:

- **Sólido**: barra de progreso, borde de selección, ícono. Es un elemento gráfico: pide **3:1** contra la tarjeta y
  contra el fondo (WCAG 1.4.11).
- **Suave**: fondo de la etiqueta.
- **Texto**: el texto de la etiqueta. Es texto normal: pide **4.5:1** contra el tono suave.

En la lámpara los cuatro tienen menos croma (C) y van hacia tonos cálidos para no chocar con el beige. En el oscuro
se aclaran (L alta) y el suave pasa a ser un fondo oscuro teñido.

| Estado | Tema | Sólido | Suave | Texto | Contraste (sólido/tarjeta · texto/suave) |
|---|---|---|---|---|---|
| `success` | Claro | `#2E8B3E` | `#E6F4E8` | `#1E6B2C` | 4.30 · 5.78 |
| | Lámpara | `#3F7A33` | `#E3E6C8` | `#2E5C25` | 4.72 · 6.14 |
| | Oscuro | `#5CBF6B` | `#1E3322` | `#8FD99A` | 7.26 · 8.09 |
| `warning` | Claro | `#B7860B` | `#FBF1D6` | `#7A5600` | 3.27 · 5.91 |
| | Lámpara | `#9A6F0A` | `#F0DDB0` | `#6B4A00` | 4.10 · 6.02 |
| | Oscuro | `#E2B23C` | `#3A2F14` | `#F0CD73` | 8.50 · 8.57 |
| `danger` | Claro | `#C8372D` | `#FBE6E4` | `#9E2A21` | 5.20 · 6.25 |
| | Lámpara | `#B03A26` | `#F2D3C4` | `#8A2A1A` | 5.48 · 6.14 |
| | Oscuro | `#EE6B5E` | `#3D1E1A` | `#F5A096` | 5.50 · 7.40 |
| `info` | Claro | `#2F7BC4` | `#E4F0FA` | `#1F5E9C` | 4.42 · 5.78 |
| | Lámpara | `#3A6E9E` | `#DCE3E2` | `#28517A` | 4.89 · 6.33 |
| | Oscuro | `#5DA4E8` | `#182A3D` | `#9CC8F2` | 6.33 · 8.32 |

`danger` reemplaza al `destructive` de shadcn: se mapea `--destructive` a `--danger` para que los componentes de
shadcn lo usen sin cambios.

**Significado en este sistema** (propuesta):

| Estado | Dónde |
|---|---|
| `success` | Préstamo al día, ejemplar disponible, multa pagada, lectura terminada |
| `warning` | Préstamo **por vencer** (*pendiente: no existe regla; el umbral de días iría en `configuracion`, C-04*), multa pendiente, reserva en espera |
| `danger` | Préstamo vencido, ejemplar perdido, cuenta bloqueada, errores de formulario |
| `info` | Préstamo digital, reserva lista para retirar, avisos neutros |

## Lenguaje de bloques (DI-08)

| Elemento | Cómo se ve | Cómo se construye |
|---|---|---|
| Tarjeta | Fondo `card`, borde de 1px `border`, radio del preset Maia (`rounded-2xl`, 1.8 × `--radius`), sin sombra | `Card` de shadcn con `border border-border` en lugar de su `ring-1` (R4a) |
| Tarjeta seleccionada | Borde de color y fondo teñido (como "Want to Reread") | Borde `primary` (o el color de estado) + fondo `accent`. El borde pide 3:1 porque comunica estado |
| Bandeja | Bloque `muted` que agrupa tarjetas (la fila de portadas) | Un `div` con `bg-muted` y `rounded` |
| Encabezado de tarjeta | Una línea fina separa el encabezado del contenido (las citas, "Your Impression") | `border-b` con `border` |
| Barra con rayas | Barra de progreso con líneas verticales finas encima del color | `Progress` de shadcn + `repeating-linear-gradient` con líneas más claras del mismo color. Las rayas son decorativas: el porcentaje va siempre escrito |
| Agregar algo nuevo | Borde **punteado** de color con ícono "+" (como "New Folder") | `border-dashed` con `primary` |
| Etiqueta | Píldora con ícono, fondo suave y texto del estado (como "Skill Booster") | `Badge` de shadcn con las variantes `success`, `warning`, `danger` e `info` (R4a) |
| Línea de tiempo | Línea vertical punteada que une pasos (como "Reading Journey") | `border-l border-dashed`. Uso posible: historial de un préstamo (prestado → renovado → devuelto) |

## Equivalencias para pasar una pantalla a tokens (R5)

Una pantalla terminada no tiene `zinc-*`, `red-*`, `emerald-*`, `amber-*`, `blue-*` ni `dark:`: los tokens ya cambian
con el tema. Revisarla con `grep -nE "zinc-|red-|emerald-|amber-|blue-|dark:" archivo.tsx` (debe salir vacío).

| Antes | Después | Nota |
|---|---|---|
| `text-zinc-900 dark:text-zinc-50` (texto principal) | nada (hereda `text-foreground` del `body`) | Solo se escribe `text-foreground` para volver al principal dentro de algo gris |
| `text-zinc-500`, `text-zinc-600 dark:text-zinc-400`, `text-zinc-700 dark:text-zinc-300` (texto secundario) | `text-muted-foreground` | Contraste AA medido en los tres temas |
| `text-zinc-400` (deshabilitado, decorativo) | `text-muted-foreground` + `opacity-50` | Solo para lo que no se puede usar |
| `border-zinc-200 dark:border-zinc-800`, `border-zinc-300 dark:border-zinc-700` | `border-border` | También `divide-border` |
| `bg-white dark:bg-zinc-900` + `border` + `shadow-sm` (tarjeta) | `rounded-2xl border border-border bg-card` | Sin sombra (DI-08). Si encaja en columna, `<Card>` |
| `bg-zinc-100 dark:bg-zinc-800` (fondo gris, bandeja) | `bg-muted` | `hover:bg-muted` para el *hover* |
| Botón `bg-zinc-900 text-white …` | `<Button>`, o `buttonVariants()` en un `<Link>`; en formularios, `claseBoton` | `variant`: `default`, `outline`, `destructive`, `ghost` |
| Píldora de estado con `red-*`, `emerald-*`, `amber-*` | `<Badge variant="danger" \| "success" \| "warning" \| "info" \| "secondary">` | Significado de cada color en "Colores de estado" |
| Mensaje con `bg-red-50 text-red-800 …` | `<MensajeFormulario>` o `border-danger/40 bg-danger-suave text-danger-texto` | Igual con `success`, `warning`, `info` |
| Campo con `focus:ring-blue-600` | `claseCampo` y `claseEtiqueta` (`components/ui-formulario.tsx`) | |
| "Sin préstamos." en texto suelto | `<EstadoVacio accion={…}>` | La acción siguiente, si la hay |
| Tarjeta con barra de color del libro | `<Portada>` | El color de la sección queda en `InsigniaSeccion` |

## Tipografía

| Uso | Fuente | Nota |
|---|---|---|
| Títulos | **Fraunces** (serif variable de Google Fonts, cargada con `next/font` en `--font-fraunces`), en el token `--font-heading`. Se aplica a `h1`, `h2` y `h3` | El toque de biblioteca de "Books". Decidido en R2 |
| Texto e interfaz | **Figtree** (`--font-sans`, viene con Maia) | Geométrica y redondeada, cercana a YowBooks |
| Códigos de barras | **Geist Mono** (`--font-mono`) | Se conserva de las fases anteriores |

## Lector digital (DI-06)

- El EPUB y el PDF son **ediciones** del mismo título (`edicion_digital`, `UNIQUE (id_libro, formato)`). Si el título
  tiene EPUB, se abre ese; el PDF queda como "Ver en PDF".
- **Seguridad:** un EPUB es HTML y puede traer JavaScript. Se pinta en un `iframe` sin ejecutar scripts (foliate-js no
  los ejecuta) y la ruta del lector lleva una CSP. Pendiente de escribir como regla RN en R8.
- Tema: el contenido del libro toma `background` y `foreground` del tema activo. En PDF, la lámpara se aproxima con un
  filtro (`sepia`) sobre el canvas.

**Para poder cambiar a Readium después**, tres límites:

1. **El motor queda detrás de un componente.** Las páginas usan `<Visor formato="epub" | "pdf" …>` y no saben qué
   librería hay dentro. Cambiar el motor toca un solo archivo.
2. **El archivo guardado no cambia.** En `storage/` sigue el `.epub` original y la ruta que verifica el acceso (RN-29)
   sigue siendo la misma. Readium necesitaría además un paso en el servidor que abra el EPUB y publique su *manifest*:
   sería una ruta nueva, sin tocar los datos.
3. **La posición de lectura, si se guarda, en un formato portable**: el progreso (0 a 1) y el capítulo, no estructuras
   internas de foliate-js.

## Pasos de la Fase R

| Paso | Contenido |
|---|---|
| R0 | Esta ficha |
| R1 | `shadcn init` (Radix, `new-york`) y revisión de lo que genera |
| R2 | Tokens de los tres temas en `globals.css`, tipografía, cookie del tema y botón sol, luna y lámpara |
| R3 | Esqueleto (DI-10, DI-11): barra superior, menú de usuario, `lib/permisos.ts`, rutas del panel por sección con su sub-navegación, `/panel` que redirige por rol, pestañas de "Mi cuenta", `?siguiente=` en el login (RN-83) |
| R4 | Componentes base, `Portada` generada y estados comunes (vacío, error) |
| R5 | Pantallas (catálogo, detalle, cuenta repartida en pestañas, panel, login y registro), aviso "por vencer" (RN-76) y filtro del visor PDF |
| R6 | Verificación: contraste en los tres temas, teclado, celular y recorrido de cada rol (auditoría UX) |
| R7 | Mi cuenta: perfil y datos (RN-77), contraseña (RN-78), correo (RN-79), recuperar contraseña (RN-80), avatar DiceBear y foto (RN-81, RN-82), tema en la cuenta. Cambia el esquema (ver `modelo-datos.md`) |
| R8 | Lector EPUB con foliate-js: reglas (RN-54 y seguridad), EPUB de muestra en `archivos:muestra`, `<Visor>` |
