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
| `docker-compose.yml` con MySQL 8 (puerto 3307) | **Siguiente** |
| `db/schema.sql` por bloques, verificado en MySQL | Pendiente |
| `db/seed.sql` (casos que ejerzan cada regla) y `db/consultas.sql` | Pendiente |

## Próximo paso

Escribir `docker-compose.yml` con MySQL 8 (versión de imagen fija, volumen para los datos, `db/` montado
para la carga inicial) y verificar que levanta con las variables de `.env`.

## Pendientes y avisos

- Verificar el PC de escritorio: `node -v` (22 LTS), `pnpm -v`, `docker compose version`, `ssh -T git@github.com`.
- Por verificar al escribir el SQL: la limitación de MySQL sobre `CHECK` en columnas cuya FK tiene acciones `ON DELETE/UPDATE`.
- Fase 1: `create-next-app` puede negarse a crear el proyecto en una carpeta con archivos (este repo ya tiene
  `docs/`, `README.md`, `CLAUDE.md`…). Supuesto a verificar; si pasa, se genera en una carpeta temporal y se integra.
