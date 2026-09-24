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
| `db/init/01_schema.sql` — bloques 2 a 5 | **Siguiente** |
| `db/init/02_seed.sql` (casos que ejerzan cada regla) y `db/consultas.sql` | Pendiente |

## Próximo paso

Bloque 2 del esquema (cuentas, préstamos físicos, reservas, multas) en `db/init/01_schema.sql`.
Como el script de inicio solo corre con el volumen vacío, para aplicar los bloques nuevos hay que recrear
la BD: `docker compose down -v && docker compose up -d --wait` (borra los datos; mientras no haya seed, no se pierde nada).

## Pendientes y avisos

- Verificar el PC de escritorio: `node -v` (22 LTS), `pnpm -v`, `docker compose version`, `ssh -T git@github.com`.
- Verificado (MySQL 8.4.11): una columna usada en un `CHECK` no puede tener acciones `ON DELETE/UPDATE` en su FK (`ERROR 3823`).
- En pruebas y seed, nunca escribir ids a mano: `AUTO_INCREMENT` no se revierte con `ROLLBACK`. Usar `LAST_INSERT_ID()` o buscar por un dato único.
- Fase 1: `create-next-app` puede negarse a crear el proyecto en una carpeta con archivos (este repo ya tiene
  `docs/`, `README.md`, `CLAUDE.md`…). Supuesto a verificar; si pasa, se genera en una carpeta temporal y se integra.
