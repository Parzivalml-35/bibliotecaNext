# Estado del proyecto

> Se actualiza al final de cada sesión, en el mismo commit. Es lo primero que se lee al retomar en cualquier equipo.

**Última actualización:** 2026-09-24 (portátil)

## Fase actual: 0 — Diseño del dominio

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
| `db/consultas.sql` con las consultas clave de la app | **Siguiente** |
| Reconstrucción completa con schema + seed (`docker compose down -v`) | Pendiente (requiere confirmación) |

## Próximo paso

`db/consultas.sql`: disponibilidad y ubicación por sede, estado deducido del lector (bloqueo, edad), cola de reservas,
licencias en uso, total del pedido y consulta detectora (RN-24). Después, reconstrucción completa para probar que
`01_schema.sql` + `02_seed.sql` levantan juntos en un volumen vacío, y cierre de la Fase 0.

## Pendientes y avisos

- Verificar el PC de escritorio: `node -v` (22 LTS), `pnpm -v`, `docker compose version`, `ssh -T git@github.com`.
- Verificado (MySQL 8.4.11): una columna usada en un `CHECK` no puede tener acciones `ON DELETE/UPDATE` en su FK (`ERROR 3823`).
- Verificado con dos sesiones simultáneas: sin `FOR UPDATE` una licencia única se prestó dos veces; con `FOR UPDATE` la segunda sesión esperó el `COMMIT` y no prestó. Primero bloquear, después contar.
- `information_schema.tables.table_rows` es una estadística en caché, no un conteo: usar `COUNT(*)`.
- En pruebas y seed, nunca escribir ids a mano: `AUTO_INCREMENT` no se revierte con `ROLLBACK`. Usar `LAST_INSERT_ID()` o buscar por un dato único.
- Fase 1: `create-next-app` puede negarse a crear el proyecto en una carpeta con archivos (este repo ya tiene
  `docs/`, `README.md`, `CLAUDE.md`…). Supuesto a verificar; si pasa, se genera en una carpeta temporal y se integra.
