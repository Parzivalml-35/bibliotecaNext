# bibliotecaNext

Sistema para administrar una red de bibliotecas: catálogo con ubicación física, préstamos y reservas,
préstamo digital con licencias y venta de libros. Proyecto de aprendizaje con Next.js (App Router),
TypeScript, Tailwind CSS y MySQL con SQL escrito a mano.

> **Estado:** Fase 0 — diseño del dominio. Todavía no hay aplicación; ver [docs/estado.md](docs/estado.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/reglas-de-negocio.md](docs/reglas-de-negocio.md) | Cómo funciona el sistema (D-xx, RN-xx, C-xx). Fuente de verdad. |
| [docs/modelo-datos.md](docs/modelo-datos.md) | Modelo de datos por bloques, derivado de las reglas |
| [docs/estado.md](docs/estado.md) | En qué fase y paso vamos, y qué sigue |
| [CLAUDE.md](CLAUDE.md) | Contexto y reglas de trabajo para Claude Code |

## Requisitos

| Herramienta | Versión usada | Cómo comprobarla |
|---|---|---|
| Node.js | 22 LTS (22.23.2) | `node -v` |
| pnpm | 11.20.0 | `pnpm -v` |
| Docker + Docker Compose | Compose v2 o superior | `docker compose version` |
| Git con acceso SSH a GitHub | — | `ssh -T git@github.com` |

## Puesta en marcha en un equipo nuevo

```bash
git clone git@github.com:Parzivalml-35/bibliotecaNext.git
cd bibliotecaNext
cp .env.example .env        # y cambia las contraseñas en .env
```

Levantar MySQL (la primera vez descarga la imagen y ejecuta `db/init/*.sql`):

```bash
docker compose up -d --wait
```

MySQL queda en `127.0.0.1:3307` (usuario y base de datos según `.env`). Los scripts de `db/init/` **solo se
ejecutan con el volumen vacío**; para aplicar cambios de esquema hay que recrear la BD, lo que borra sus datos:

```bash
docker compose down -v && docker compose up -d --wait
```

Pasos que se agregan cuando existan (Fase 1): `pnpm install` y `pnpm dev`.

## Rutina al trabajar en dos equipos

1. **Al empezar:** `git pull`. Si cambió `pnpm-lock.yaml`, `pnpm install`; si cambió `db/`, recrear la BD.
2. **Al terminar:** actualizar `docs/estado.md`, hacer commit y `git push`.
3. Los datos de la BD no se sincronizan: se reconstruyen desde `db/*.sql`. Todo cambio de esquema va en un archivo versionado.
