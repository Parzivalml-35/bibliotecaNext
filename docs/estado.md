# Estado del proyecto

> Se actualiza al final de cada sesión, en el mismo commit. Es lo primero que se lee al retomar en cualquier equipo.

**Última actualización:** 2026-09-24 (portátil)

## Fase actual: 0 — Diseño del dominio

| Paso | Estado |
|---|---|
| Reglas de negocio (`docs/reglas-de-negocio.md`, RN-01 a RN-61) | Hecho |
| Modelo de datos por bloques (`docs/modelo-datos.md`, 41 tablas) | Hecho |
| Documentación de la fase en el vault (`Biblioteca Next`) | Hecho |
| Base del repo: README, CLAUDE.md, estado, .gitignore, .env.example | Hecho |
| `docker-compose.yml` con MySQL 8.4 (puerto 3307), `db/init/` montado | Hecho |
| `db/init/01_schema.sql` — bloque 1 (catálogo y ubicación, 13 tablas), verificado | Hecho |
| `db/init/01_schema.sql` — bloque 2 (cuentas, préstamos, reservas, multas, 9 tablas), verificado | Hecho |
| `db/init/01_schema.sql` — bloque 3 (traslados y auditorías, 5 tablas), verificado | Hecho |
| `db/init/01_schema.sql` — bloque 4 (préstamo digital, 4 tablas), verificado + prueba de concurrencia | Hecho |
| `db/init/01_schema.sql` — bloque 5 (compras) | **Siguiente** |
| `db/init/02_seed.sql` (casos que ejerzan cada regla) y `db/consultas.sql` | Pendiente |

## Próximo paso

Bloque 5 del esquema (compras) en `db/init/01_schema.sql`.
Cada bloque nuevo se aplica solo sobre la BD en marcha (`awk` desde el marcador del bloque) y se prueba con transacciones
que terminan en `ROLLBACK`. Al terminar los 5 bloques: reconstrucción completa con `docker compose down -v` (con confirmación)
para probar que el repo levanta la BD desde cero.

## Pendientes y avisos

- Verificar el PC de escritorio: `node -v` (22 LTS), `pnpm -v`, `docker compose version`, `ssh -T git@github.com`.
- Verificado (MySQL 8.4.11): una columna usada en un `CHECK` no puede tener acciones `ON DELETE/UPDATE` en su FK (`ERROR 3823`).
- Verificado con dos sesiones simultáneas: sin `FOR UPDATE` una licencia única se prestó dos veces; con `FOR UPDATE` la segunda sesión esperó el `COMMIT` y no prestó. Primero bloquear, después contar.
- En pruebas y seed, nunca escribir ids a mano: `AUTO_INCREMENT` no se revierte con `ROLLBACK`. Usar `LAST_INSERT_ID()` o buscar por un dato único.
- Fase 1: `create-next-app` puede negarse a crear el proyecto en una carpeta con archivos (este repo ya tiene
  `docs/`, `README.md`, `CLAUDE.md`…). Supuesto a verificar; si pasa, se genera en una carpeta temporal y se integra.
