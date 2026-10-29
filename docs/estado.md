# Estado del proyecto

> Se actualiza al final de cada sesión, en el mismo commit. Es lo primero que se lee al retomar en cualquier equipo.

**Última actualización:** 2026-10-29 (portátil) — Fase R (rediseño) en curso en la rama `feat/rediseno`: R0 a R3 hechos; sigue R4

## Fase 0 — Diseño del dominio (terminada)

| Paso | Estado |
|---|---|
| Reglas de negocio (`docs/reglas-de-negocio.md`, RN-01 a RN-61) | Hecho |
| Modelo de datos por bloques (`docs/modelo-datos.md`, 40 tablas) | Hecho |
| Documentación de la fase en el vault (`Biblioteca Next`) | Hecho |
| Base del repo: README, CLAUDE.md, estado, .gitignore, .env.example | Hecho |
| `docker-compose.yml` con MySQL 8.4 (puerto 3307), `db/init/` montado | Hecho |
| `db/init/01_schema.sql` — bloque 1 (catálogo y ubicación, 13 tablas), verificado | Hecho |
| `db/init/01_schema.sql` — bloque 2 (cuentas, préstamos, reservas, multas, 9 tablas), verificado | Hecho |
| `db/init/01_schema.sql` — bloque 3 (traslados y auditorías, 5 tablas), verificado | Hecho |
| `db/init/01_schema.sql` — bloque 4 (préstamo digital, 4 tablas), verificado + prueba de concurrencia | Hecho |
| `db/init/01_schema.sql` — bloque 5 (compras, 9 tablas), verificado. Esquema completo: 40 tablas | Hecho |
| Reconstrucción completa desde cero: 40 tablas, 79 FK, 54 CHECK, 34 UNIQUE, 5 columnas generadas | Hecho |
| `db/init/02_seed.sql`: 16 libros reales (ISBN verificados), 3 sedes, 32 ejemplares, 7 lectores, escenarios de las reglas; detector RN-24 = 0 | Hecho |
| `db/consultas.sql`: 12 consultas clave (catálogo, ubicación, lector, cola, traslados, licencias, pedidos, detector), verificadas | Hecho |
| Reconstrucción completa: schema + seed en volumen vacío, 12 consultas sin errores, detector = 0 | Hecho |

## Fase 1 — Scaffold y primera conexión (terminada)

| Paso | Estado |
|---|---|
| Scaffold Next.js 16.3.6 (App Router, TS, Tailwind 4), integrado sin pisar README/CLAUDE.md/.gitignore | Hecho |
| Parte A: `lib/db.ts` (pool mysql2 + server-only), `lib/definitions.ts`, `lib/data/libros.ts` con `connection()`, página mínima con los 16 libros | Hecho |
| Corrección de codificación: `SET NAMES utf8mb4` en los scripts y BD reconstruida | Hecho |
| Parte B: catálogo con Tailwind (`components/tarjeta-libro.tsx`, grilla responsive, encabezado en el layout) | Hecho |
| Documentación de la Fase 1 en el vault (`Biblioteca Next - Fase 1 - Next.js y catálogo`, `Next.js`, `Tailwind`, `SQL`) | Hecho |
| Verificar el repo en el PC de escritorio solo con el README | Hecho (confirmado por el usuario) |

## Fase 2 — Catálogo con búsqueda y "¿dónde está el libro?" (terminada y documentada)

Orden acordado: A (detalle del libro) → B (búsqueda en servidor) → C (búsqueda interactiva, paginación, carga y error).
El libro se identifica en la URL por su **ISBN** (`/libros/9788420471839`): clave natural, estable entre reconstrucciones.

| Paso | Estado |
|---|---|
| A1: ruta `app/libros/[isbn]`, `generateMetadata`, `notFound()` + `app/not-found.tsx`, plantilla de títulos, `obtenerLibroPorIsbn` (con `cache()`) y `obtenerDisponibilidadPorSede` | Hecho |
| A2: diseño de la página del libro (ficha, "¿Dónde está?" con tarjeta por sede), tarjetas del catálogo enlazadas, componentes compartidos `insignia-seccion` e `insignia-disponibilidad` | Hecho |
| B: búsqueda por título o autor y filtro por sección con `searchParams` y `next/form`; `LIKE` con comodines escapados; sección validada contra la BD | Hecho |
| C1: `app/loading.tsx` y `app/libros/[isbn]/loading.tsx` (esqueletos con streaming), `app/error.tsx` con `retry()` (probado deteniendo MySQL) | Hecho |
| C2a: búsqueda mientras se escribe (`components/buscador-catalogo.tsx` como Client Component: debounce 300 ms, `router.replace`, `useTransition`); sigue funcionando sin JS | Hecho |
| C2b: paginación (`?pagina=`, 6 por página, `components/paginacion.tsx`); conteo con el mismo filtro, página ajustada al rango, orden total; la búsqueda nueva vuelve a la página 1 | Hecho |

## Fase 3 — Panel de empleado (terminada y documentada)

Decisiones: **sesión en BD propia** (tabla `sesion`, cookie con token aleatorio, solo su hash SHA-256 en la BD;
revocable al instante), contraseñas con **scrypt** de Node (N=2^17, r=8, p=1) y contraseñas de desarrollo con
`pnpm db:claves-dev` (lee `DEV_PASSWORD` del `.env`; nada de contraseñas en el repo). Reglas: RN-62 a RN-65.

| Paso | Estado |
|---|---|
| A1: reglas RN-62..64, tabla `sesion` y `configuracion.horas_sesion` (BD reconstruida, 41 tablas), `lib/contrasenas.ts`, `scripts/claves-dev.ts` | Hecho |
| A2: `/login` con Server Action (`lib/actions/sesion.ts`) y `useActionState`; cookie `httpOnly`/`sameSite=lax`; cierre de sesión por POST; mismo mensaje y mismo tiempo (~300 ms) si el correo no existe | Hecho |
| A3: DAL `lib/sesion.ts` (`obtenerUsuario` con `cache()`, `exigirEmpleado(roles)`), `/panel` protegido en cada página y acción, menú de usuario en el encabezado dentro de `<Suspense>` | Hecho |
| B: préstamo (`lib/actions/circulacion.ts`) en una transacción (`enTransaccion` en `lib/db.ts`): RN-02, RN-03, RN-10, RN-23, RN-34, RN-43, RN-46, RN-48, D-03; renovación RN-04 + RN-65 | Hecho |
| C: devolución con multa (RN-05), cola de reservas (RN-11), colección flotante (RN-13, RN-20, RN-47) | Hecho |
| Verificación de punta a punta (formularios enviados sin JS con un script): más de 30 casos de login, permisos, préstamo, devolución, renovación, CSRF y carrera de dos préstamos simultáneos; detector RN-24 = 0 | Hecho |

## Fase 4 — Lector en la web y mostrador completo (terminada y documentada)

Decisiones (RN-66 a RN-72): multas pagadas **en mostrador o en línea** (pago simulado, tabla `pago` generalizada a
pedidos y multas); **anular** solo coordinador de la sede del préstamo o administrador, con motivo; al prestar se
**cancelan** las otras reservas vivas del lector por esa obra; **la cola manda** (una copia que queda libre con cola
se aparta, también al ubicar); registro con verificación por correo simulado en la consola; un perdido deja de contar
como préstamo vencido. Esquema: `configuracion` (+2), `multa` (+3, anulación), `pago` (+4, generalizado). Catálogo
simulado: `db/init/03_catalogo_simulado.sql` (96 libros ficticios, ISBN `999…`, 264 ejemplares).

| Bloque | Qué | Estado |
|---|---|---|
| A | `/registro`, `/verificar` (el GET muestra un botón; el POST consume el token), `/cuenta` con préstamos, multas, reservas y motivos de bloqueo | Hecho |
| B | Reservar desde `/libros/[isbn]` (asignación inmediata o cola), cancelar; posición en la cola | Hecho |
| C | `/panel/lectores` (buscar, validar, cobrar, anular), `/panel/ubicar` (estante sugerido), `/panel/perdidos` | Hecho |
| D | `/panel/tablero` (indicadores, traslados sugeridos, detector RN-24) para coordinador y administrador | Hecho |
| Catálogo | 112 libros, paginación con ventana (`1 … 6 7 8 … 13`) | Hecho |
| 4b | Límite de intentos (RN-73): tabla `intento_acceso`, rechazo antes de scrypt por correo e IP, límite de registros por IP | Hecho |
| Verificación | 56 casos de punta a punta contra `next start` en el puerto 3001 (para leer el correo simulado), BD revisada tras cada bloque; detector RN-24 = 0 | Hecho |

## Fase 5 — Préstamo digital (terminada)

Decisiones del usuario: lectura **solo en la web con su perfil**, sin descarga (visor propio con pdf.js; RN-29
reescrita con el límite asumido); PDFs de muestra generados por script; la cola se procesa en las acciones y la página
muestra el turno calculado ("Tomar el préstamo"); con licencia libre se presta al instante y solo se reserva sin
licencias; basta la cuenta verificada; un lector bloqueado no pide pero sigue leyendo; edad según la clasificación;
licencias en `/panel/licencias` (administrador de red), subir archivos para después. Además, **RN-74**: documento,
teléfono y dirección obligatorios desde el registro.

| Bloque | Qué | Estado |
|---|---|---|
| 0 | RN-74: registro con documento (CC ≥ 18, TI < 18), teléfono, dirección y ciudad; documento repetido = misma respuesta y aviso al dueño; el mostrador coteja el documento; esquema `lector` con `NOT NULL` | Hecho |
| A | `lib/data/digital.ts`, `lib/actions/digital.ts`; en `reglas.ts`: `elegirLote` (RN-55), `procesarColaDigital` (RN-28, RN-48), `enviarCorreo` (movido desde `cuenta.ts`) y `TIPOS_DOCUMENTO` | Hecho |
| B | Sección "Leer en línea" en `/libros/[isbn]` (pedir, reservar, confirmar, tomar el turno, devolver, cancelar) y "Libros digitales" en `/cuenta` | Hecho |
| C | `app/leer/[isbn]/archivo/route.ts` (sesión + acceso, solo `Sec-Fetch-Dest: empty` del mismo origen, `no-store`), visor `components/visor-pdf.tsx`, `pnpm archivos:muestra` | Hecho |
| D | `/panel/licencias`: uso por lote y registrar un lote (las licencias nuevas van primero a la cola) | Hecho |
| Fix | **RN-75** (encontrado probando en el PC): un lector no puede tener dos préstamos físicos de la misma obra, sin excepciones; espejo de RN-68. Validación en la transacción de `prestarEjemplar` (`tienePrestadaLaObra` con `FOR SHARE`), no con UNIQUE (`id_libro` vive en `ejemplar`); la página del libro muestra "Ya tienes este libro prestado". Commit `d88383f` | Hecho |
| Verificación | Registro (8 casos), validación, lectura (7 casos de acceso), cola, RN-55, máximos, bloqueos, edad, ids ajenos, cola detenida, lote nuevo con cola, concurrencia (2 pedidos por la última licencia: 1 gana), visor en Chrome sin ventana | Hecho |

## Fase R — Rediseño con shadcn/ui (en curso, rama `feat/rediseno`)

Va antes de la Fase 6. Fuente de verdad: `docs/diseno.md` (DI-01 a DI-12); hallazgos de partida en `docs/auditoria-ux.md`. Decisiones: shadcn sobre **Radix**, preset
**Maia** con Hugeicons y Figtree; **barra superior** estilo "Books" (sin sidebar); temas **claro, oscuro y lámpara**
con la preferencia en **cookie** (y en la cuenta en R7); portada generada; bloques con borde fino y barras con rayas
(estilo YowBooks "My Library"); cuatro colores de estado con contraste AA medido; lector **EPUB con foliate-js** y PDF
como alternativa, preparado para Readium.

| Paso | Qué | Estado |
|---|---|---|
| R0 | Ficha de diseño `docs/diseno.md`: referencias, decisiones, paletas de los tres temas en oklch con contraste, colores de estado, lenguaje de bloques, lector | Hecho |
| R1 | `shadcn init -b radix -t next --preset maia` (probado antes en una copia): `components.json`, `lib/utils.ts` (`cn`), `components/ui/button.tsx`, tokens neutros en `globals.css`; Figtree en lugar de Geist Sans (Geist Mono se queda para los códigos) | Hecho |
| Auditoría | `docs/auditoria-ux.md` (UX-01 a UX-12; la más grave: el menú del panel es igual para todos los roles). Mapa del sitio, secciones del panel por rol y `lib/permisos.ts` como fuente única (DI-10 a DI-12). Reglas nuevas RN-76 a RN-83 (por vencer, datos editables, contraseña, correo, recuperar, avatar DiceBear y foto, `?siguiente=`). Cambios de esquema planificados en `modelo-datos.md` (bloque 2) | Hecho (solo documentación) |
| R2 | Tres paletas en `globals.css`, `dark:` → `[data-tema="oscuro"]`, cookie del tema leída por un script del `<head>` (sin cookie, el sistema), botón sol, luna y lámpara, Fraunces para títulos | Hecho (falta revisar los colores en pantalla). `lib/tema.ts`, `components/script-en-linea.tsx`, `components/boton-tema.tsx`. Resuelve UX-12 |
| R3 | Barra superior, menú de usuario, `lib/permisos.ts`, panel por secciones (URL nuevas, `/panel` redirige por rol), pestañas de "Mi cuenta", `?siguiente=` (RN-83). Cinco partes: R3a permisos, R3b secciones, R3c `?siguiente=`, R3d barra y menú, R3e pestañas de Mi cuenta | Hecho (falta probar R3e con sesión en el navegador). R3a (permisos), R3b (secciones) y R3c (`?siguiente=`, RN-83: `rutaInterna()` en `lib/sesion.ts`, cada página pasa su ruta, enlaces "Inicia sesión" de la ficha) hechos. R3d hecho: barra superior con tokens, pestañas en píldora por perfil (`NavegacionPrincipal`), menú lateral en el celular (`Sheet`), menú de la cuenta con avatar de iniciales (`DropdownMenu`) e "Iniciar sesión" con `?siguiente=`. R3e hecho: `app/cuenta/layout.tsx` con `NavegacionCuenta` (comparación exacta de la ruta: `/cuenta` es prefijo de todas), `/cuenta` repartida en Resumen, `/cuenta/prestamos`, `/cuenta/digitales` y `/cuenta/multas` (resuelve UX-04); `resumen-lector.tsx` exporta sus piezas y el panel las sigue usando juntas |
| R4 | Componentes base y `Portada` generada | Pendiente |
| R5 | Pantallas (35 archivos con `zinc-*` a mano), `/cuenta` repartida en pestañas, aviso "por vencer" (RN-76), visor inmersivo y filtro del PDF | Pendiente |
| R6 | Verificación: contraste en los tres temas, teclado, celular y recorrido de cada rol | Pendiente |
| R7 | Mi cuenta: datos (RN-77), contraseña (RN-78), correo (RN-79), recuperar (RN-80), avatar DiceBear y foto (RN-81, RN-82), tema en la cuenta. Cambia el esquema. Decidir la librería para recodificar fotos (`sharp` está desactivado en `pnpm-workspace.yaml`) | Pendiente |
| R8 | Lector EPUB con foliate-js: reglas (RN-54, seguridad del HTML del libro), EPUB de muestra, `<Visor>` | Pendiente |

Efecto temporal hasta R5: las pantallas todavía usan `zinc-*` escritos a mano. Se ven bien en claro y oscuro, pero
en la lámpara las tarjetas y la barra superior quedan blancas (solo el fondo de la página toma el beige).

## Próximo paso

1. Probar R3e con sesión (lector y empleado con `/panel/lectores`); después **R4** de la Fase R: componentes base y `Portada` generada.
2. `/documentar`: lo pendiente de la Fase 4 (prueba en navegador de las fases 3 y 4, 2026-10-24), RN-75 y el choque
   de numeración RN-74 entre los dos equipos; después, la Fase R.
3. Volver a probar RN-75 con la BD reconstruida: otra copia de "Cien años de soledad" a Ana debe rechazarse.
4. Fase 6: compras (RN-36 a RN-42, RN-57 a RN-61) + **pasarela con notificación firmada** (Route Handler que
   verifica una firma HMAC, para pedidos y multas; hoy la pasarela simulada se confirma con un botón).
5. **Fase 7: administración de la red** (empleados, catálogo, tipos de lector, configuración; RN-33). Antes, decidir
   las preguntas de "Pendiente de definir" en `reglas-de-negocio.md`.
6. Fase 8: traslados y auditorías (RN-15, RN-16, RN-21, RN-50 a RN-53) + **recuperar un ejemplar declarado perdido**
   (antes: regla para su multa de reposición: anular si está pendiente, ¿reembolsar si ya se pagó?).
7. Fase 9: calidad (Lighthouse, accesibilidad, build). Pendiente de la Fase 5: subir archivos PDF desde el panel.

## Pendientes y avisos

- PC de escritorio: BD reconstruida con el esquema de la Fase 5 y PDF de muestra generados (verificado 2026-10-26).
- Al pasar la rama `feat/rediseno` al otro equipo: `pnpm install` (shadcn agrega `radix-ui`, `cn`, `class-variance-authority`, `tw-animate-css`, `@hugeicons/*` y `shadcn`).
- RN-29, límite asumido: lo que el navegador muestra se puede capturar. La ruta del archivo rechaza abrirlo desde la barra
  de direcciones (`Sec-Fetch-Dest: document`) y otros sitios, pero un programa fuera del navegador puede inventar esas
  cabeceras: la protección real es la sesión + el préstamo vigente o la compra.
- Si dos lectores piden la última licencia a la vez, el que pierde no ve el mensaje de error: la página se vuelve a
  dibujar con "Reservar" en lugar de "Pedir prestado" (mismo caso de `useActionState` de abajo).
- Correos simulados enviados dentro de una transacción que luego hace ROLLBACK ya se "enviaron" (consola). Con un
  proveedor real, enviar después del COMMIT.
- RN-73 y la IP: Next 16 solo rellena `x-forwarded-for` si la petición no lo trae (`server/base-server.js`), así que un
  cliente puede mandarlo inventado. Se toma la ÚLTIMA entrada (la que agrega un proxy de confianza). Sin proxy delante,
  el límite por IP se puede evadir; el límite por correo no. Al desplegar: proxy que agregue la IP real.
- Tras una Server Action con `revalidatePath`, si el formulario deja de renderizarse (la reserva ya existe, la multa ya
  se pagó), su mensaje de `useActionState` se pierde con él: el resultado se muestra en el contenido nuevo de la página.
- `notFound()` bajo `loading.tsx` también responde 200 (`NEXT_HTTP_ERROR_FALLBACK;404` en el stream), como `redirect()`.
- `pkill -f` desde la shell de Claude termina con código 144 y mata la propia orden: detener servidores por puerto (`ss -ltnp`).
- **Bug encontrado y corregido (Fase 3):** contar con subconsultas normales dentro de una transacción no ve lo que
  otra transacción confirmó mientras esta esperaba un candado (`REPEATABLE READ` lee la "foto" tomada en la primera
  lectura). Dos préstamos simultáneos dejaron a un lector con 3 de 2. Solución: bloquear primero y contar con
  lecturas con bloqueo (`FOR SHARE`), que leen la última versión confirmada (`situacionDelLector`).
- `redirect()` en una página que está bajo un `loading.tsx` responde **200** y la redirección viaja en el stream
  (`NEXT_REDIRECT`): el contenido protegido no se envía, pero el código HTTP no es 3xx. En una Server Action sí es 303.
- Las fechas del seed son relativas al día de la reconstrucción: tras unos días, los préstamos "al día" vencen.
  La BD del portátil quedó con los datos de las pruebas del 2026-10-21; para volver a los escenarios, reconstruirla.
- Todo lo que se exporta de un archivo `"use server"` es un endpoint público: los ayudantes no se exportan.
- En el otro PC (si aún no se hizo tras la A1): agregar `DEV_PASSWORD` (≥12 caracteres) al `.env`, reconstruir la BD (cambió el esquema) y correr `pnpm db:claves-dev`.
- scrypt con N=2^17 necesita `maxmem` > 128 MiB: sin él, `RangeError: Invalid scrypt params: … memory limit exceeded`.
- Node 22.23 ejecuta `.ts` directamente: imports con extensión `.ts`, sin alias `@/` (`"type": "module"` y `allowImportingTsExtensions` en el proyecto).
- Verificado (MySQL 8.4.11): una columna usada en un `CHECK` no puede tener acciones `ON DELETE/UPDATE` en su FK (`ERROR 3823`).
- Verificado con dos sesiones simultáneas: sin `FOR UPDATE` una licencia única se prestó dos veces; con `FOR UPDATE` la segunda sesión esperó el `COMMIT` y no prestó. Primero bloquear, después contar.
- El cliente `mysql` del contenedor se conecta en `latin1`: todo script `.sql` empieza con `SET NAMES utf8mb4;` (si no, las tildes quedan doblemente codificadas: "aÃ±os"). Detectado en la Fase 1 al mostrar los datos en Next.
- `LIMIT ? OFFSET ?` con `pool.execute()` funciona con números en mysql2 3.24.4 + MySQL 8.4.11 (verificado; el fallo que se recordaba era de versiones anteriores).
- Next 16: `error.tsx` recibe `retry()` (vuelve a pedir los datos); `reset()` sigue existiendo pero no vuelve a pedirlos. En producción el error de un Server Component llega al cliente con mensaje genérico + `digest`.
- `pool.execute()` usa sentencias preparadas: en MySQL se contabilizan en `performance_schema.prepared_statements_instances`, no en la tabla de digests. Medido así: `cache()` deja la consulta del libro en 1 ejecución por visita.
- `SUM()` sobre cero filas devuelve NULL, no 0: usar `COALESCE(SUM(...), 0)`.
- `information_schema.tables.table_rows` es una estadística en caché, no un conteo: usar `COUNT(*)`.
- En pruebas y seed, nunca escribir ids a mano: `AUTO_INCREMENT` no se revierte con `ROLLBACK`. Usar `LAST_INSERT_ID()` o buscar por un dato único.
