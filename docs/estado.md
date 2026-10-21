# Estado del proyecto

> Se actualiza al final de cada sesión, en el mismo commit. Es lo primero que se lee al retomar en cualquier equipo.

**Última actualización:** 2026-10-21 (portátil) — Fase 3 terminada (pendiente de documentar en el vault)

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

## Fase 3 — Panel de empleado (terminada)

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

## Próximo paso

1. Probar el panel en el navegador (con JavaScript): login, préstamo, devolución, renovar.
2. `/documentar` la Fase 3 (nota `Biblioteca Next - Fase 3`, conceptos: Server Actions, sesiones, aislamiento de
   transacciones; materias: Bases de datos 2 y Desarrollo Web).
3. Fase 4 (reservas, pago de multas, bloqueo de usuarios, tablero): decidir el alcance al empezar.

## Pendientes y avisos

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
