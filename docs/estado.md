# Estado del proyecto

> Se actualiza al final de cada sesión, en el mismo commit. Es lo primero que se lee al retomar en cualquier equipo.

**Última actualización:** 2026-10-01 (portátil) — Fase 2 en curso

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

## Fase 2 — Catálogo con búsqueda y "¿dónde está el libro?" (en curso)

Orden acordado: A (detalle del libro) → B (búsqueda en servidor) → C (búsqueda interactiva, paginación, carga y error).
El libro se identifica en la URL por su **ISBN** (`/libros/9788420471839`): clave natural, estable entre reconstrucciones.

| Paso | Estado |
|---|---|
| A1: ruta `app/libros/[isbn]`, `generateMetadata`, `notFound()` + `app/not-found.tsx`, plantilla de títulos, `obtenerLibroPorIsbn` (con `cache()`) y `obtenerDisponibilidadPorSede` | Hecho |
| A2: diseño de la página del libro (ficha, "¿Dónde está?" con tarjeta por sede), tarjetas del catálogo enlazadas, componentes compartidos `insignia-seccion` e `insignia-disponibilidad` | Hecho |
| B: búsqueda por título o autor y filtro por sección con `searchParams` y `next/form`; `LIKE` con comodines escapados; sección validada contra la BD | Hecho |
| C1: `app/loading.tsx` y `app/libros/[isbn]/loading.tsx` (esqueletos con streaming), `app/error.tsx` con `retry()` (probado deteniendo MySQL) | Hecho |
| C2: búsqueda mientras se escribe (primer Client Component con estado) y paginación | **Siguiente** |

## Próximo paso

Parte C2: buscador que actualiza la URL mientras se escribe (Client Component con `useRouter`, `useSearchParams`,
debounce y `useTransition`) y paginación del catálogo con `LIMIT`/`OFFSET` parametrizados.

## Pendientes y avisos

- Verificar el PC de escritorio: `node -v` (22 LTS), `pnpm -v`, `docker compose version`, `ssh -T git@github.com`.
- Verificado (MySQL 8.4.11): una columna usada en un `CHECK` no puede tener acciones `ON DELETE/UPDATE` en su FK (`ERROR 3823`).
- Verificado con dos sesiones simultáneas: sin `FOR UPDATE` una licencia única se prestó dos veces; con `FOR UPDATE` la segunda sesión esperó el `COMMIT` y no prestó. Primero bloquear, después contar.
- El cliente `mysql` del contenedor se conecta en `latin1`: todo script `.sql` empieza con `SET NAMES utf8mb4;` (si no, las tildes quedan doblemente codificadas: "aÃ±os"). Detectado en la Fase 1 al mostrar los datos en Next.
- Next 16: `error.tsx` recibe `retry()` (vuelve a pedir los datos); `reset()` sigue existiendo pero no vuelve a pedirlos. En producción el error de un Server Component llega al cliente con mensaje genérico + `digest`.
- `pool.execute()` usa sentencias preparadas: en MySQL se contabilizan en `performance_schema.prepared_statements_instances`, no en la tabla de digests. Medido así: `cache()` deja la consulta del libro en 1 ejecución por visita.
- `SUM()` sobre cero filas devuelve NULL, no 0: usar `COALESCE(SUM(...), 0)`.
- `information_schema.tables.table_rows` es una estadística en caché, no un conteo: usar `COUNT(*)`.
- En pruebas y seed, nunca escribir ids a mano: `AUTO_INCREMENT` no se revierte con `ROLLBACK`. Usar `LAST_INSERT_ID()` o buscar por un dato único.
