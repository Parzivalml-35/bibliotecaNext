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
| DI-04 | La preferencia de tema se guarda en una **cookie** que el `layout` lee en el servidor (`<html data-tema="…">` desde el primer byte, sin parpadeo). Si hay sesión, también en la cuenta (R7) | Sin dependencias y la preferencia sigue al usuario entre equipos |
| DI-05 | Portadas **generadas** (título, autor y color derivado del ISBN) mientras no haya imagen real. Cuando exista, la imagen manda y la generada queda de respaldo | Es lo que hacen los sistemas grandes para los libros sin portada |
| DI-06 | Lector digital: **EPUB con foliate-js** como formato principal y **PDF como alternativa** (el visor actual con pdf.js se conserva). Preparado para cambiar a Readium (ver más abajo) | El EPUB se reacomoda a la pantalla y toma los colores del tema: es lo que hace posible leer en modo lámpara |
| DI-07 | Contraste mínimo **WCAG AA**: 4.5:1 para texto normal y 3:1 para texto grande e íconos, en los tres temas | Los acentos de las referencias no lo cumplen con texto blanco (ver "Acento y botón") |
| DI-08 | Interfaz hecha de **bloques con borde fino** (estilo captura 3), no de sombras. Ver "Lenguaje de bloques" | Los bordes funcionan igual en los tres temas; las sombras casi no se ven sobre fondo oscuro ni sobre beige |
| DI-09 | Cuatro **colores de estado** (`success`, `warning`, `danger`, `info`), cada uno con tres tonos por tema. El color nunca es la única señal: siempre va con texto | Las barras y etiquetas de colores de la captura 3 necesitan un significado y contraste en los tres temas |

## Temas y tokens

Los nombres son los tokens semánticos de shadcn (`--background`, `--primary`…). Un tema es solo un bloque de
variables bajo un selector: `:root` (claro), `[data-tema="oscuro"]` y `[data-tema="lampara"]`. Ningún componente
sabe qué tema está activo.

Valores **propuestos**, a ajustar en R2 viéndolos en pantalla. Medidos con el algoritmo de contraste de WCAG 2.

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
| Tarjeta | Fondo `card`, borde de 1px `border`, radio `--radius`, sin sombra | `Card` de shadcn con la sombra quitada |
| Tarjeta seleccionada | Borde de color y fondo teñido (como "Want to Reread") | Borde `primary` (o el color de estado) + fondo `accent`. El borde pide 3:1 porque comunica estado |
| Bandeja | Bloque `muted` que agrupa tarjetas (la fila de portadas) | Un `div` con `bg-muted` y `rounded` |
| Encabezado de tarjeta | Una línea fina separa el encabezado del contenido (las citas, "Your Impression") | `border-b` con `border` |
| Barra con rayas | Barra de progreso con líneas verticales finas encima del color | `Progress` de shadcn + `repeating-linear-gradient` con líneas más claras del mismo color. Las rayas son decorativas: el porcentaje va siempre escrito |
| Agregar algo nuevo | Borde **punteado** de color con ícono "+" (como "New Folder") | `border-dashed` con `primary` |
| Etiqueta | Píldora con ícono, fondo suave y texto del estado (como "Skill Booster") | `Badge` de shadcn con variantes por estado |
| Línea de tiempo | Línea vertical punteada que une pasos (como "Reading Journey") | `border-l border-dashed`. Uso posible: historial de un préstamo (prestado → renovado → devuelto) |

## Tipografía

| Uso | Fuente | Nota |
|---|---|---|
| Títulos | Serif en el token `--font-heading` del preset (propuesta: **Fraunces**, de Google Fonts, cargada con `next/font`) | El toque de biblioteca de "Books". A decidir en R2 |
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
| R3 | Esqueleto: barra superior con pestañas y menú de usuario |
| R4 | Componentes base y `Portada` generada |
| R5 | Pantallas (catálogo, detalle, cuenta, panel, login y registro) y filtro del visor PDF |
| R6 | Verificación: contraste en los tres temas, teclado, celular |
| R7 | Mi perfil: avatar, datos y tema guardado en la cuenta. Primero las reglas |
| R8 | Lector EPUB con foliate-js: reglas (RN-54 y seguridad), EPUB de muestra en `archivos:muestra`, `<Visor>` |
