# bibliotecaNext

Sistema para administrar una red de bibliotecas: catálogo con ubicación física, préstamos y reservas,
préstamo digital con licencias y venta de libros. Proyecto de aprendizaje con Next.js (App Router),
TypeScript, Tailwind CSS y MySQL con SQL escrito a mano.

> **Estado:** Fase 3 — panel de empleado (inicio de sesión, préstamos, devoluciones y renovaciones). Catálogo, detalle del libro y búsqueda ya funcionan. Detalle y próximo paso en [docs/estado.md](docs/estado.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/reglas-de-negocio.md](docs/reglas-de-negocio.md) | Cómo funciona el sistema (D-xx, RN-xx, C-xx). Fuente de verdad. |
| [docs/modelo-datos.md](docs/modelo-datos.md) | Modelo de datos por bloques, derivado de las reglas |
| [docs/estado.md](docs/estado.md) | En qué fase y paso vamos, y qué sigue |
| [db/consultas.sql](db/consultas.sql) | Consultas clave de la app, para ejecutar a mano |
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
cp .env.example .env        # y cambia las contraseñas en .env (incluida DEV_PASSWORD, mínimo 12 caracteres)
```

Levantar MySQL (la primera vez descarga la imagen y ejecuta `db/init/*.sql`):

```bash
docker compose up -d --wait
```

MySQL queda en `127.0.0.1:3307` (usuario y base de datos según `.env`). Los scripts de `db/init/` **solo se
ejecutan con el volumen vacío**; para aplicar cambios de esquema hay que recrear la BD, lo que borra sus datos:

```bash
docker compose down -v && docker compose up -d --wait
pnpm db:claves-dev
```

Asignar la contraseña de desarrollo (`DEV_PASSWORD` del `.env`) a las cuentas de prueba del seed. Hay que
volver a correrlo **cada vez que se reconstruye la BD**:

```bash
pnpm db:claves-dev
```

Con eso se puede iniciar sesión en `/login` con cualquier cuenta `@example.com` del seed y esa contraseña:

| Cuenta | Rol | Qué ve en `/panel` |
|---|---|---|
| `jorge.perez@example.com` | Coordinador, Sede Norte | Préstamos, devoluciones y renovaciones de Norte |
| `marta.torres@example.com` | Bibliotecaria, Sede Sur | Ídem, Sede Sur |
| `diego.ramirez@example.com` | Bibliotecario, Sede Centro | Ídem, Sede Centro |
| `laura.castano@example.com` | Administradora de red | Préstamos abiertos de toda la red (no opera en mostrador) |
| `ana.ruiz@example.com` y demás | Lectores | No entran al panel |

Los préstamos piden el documento del lector (por ejemplo CC `1000000001`, Ana) y el código del ejemplar
(`BN-0002`). Las fechas del seed son relativas al día en que se construyó la BD: con el paso de los días los
préstamos "al día" vencen y los lectores quedan bloqueados. Para volver a los escenarios originales, reconstruir la BD.

Instalar dependencias y arrancar la app (con MySQL ya arriba):

```bash
pnpm install
pnpm dev                    # http://localhost:3000
```

La página de inicio debe mostrar el catálogo con 16 libros (por ejemplo "Cien años de soledad", con su tilde).

Detener todo al terminar:

- La app: `Ctrl+C` en la terminal de `pnpm dev`.
- MySQL: `docker compose stop` (conserva los datos; `down -v` en cambio **borra** el volumen).

Comprobaciones de código: `pnpm lint` y `pnpm build` (incluye el chequeo de TypeScript).

## Rutina al trabajar en dos equipos

1. **Al empezar:** `git pull`. Si cambió `pnpm-lock.yaml`, `pnpm install`; si cambió `db/`, recrear la BD.
2. **Al terminar:** actualizar `docs/estado.md`, hacer commit y `git push`.
3. Los datos de la BD no se sincronizan: se reconstruyen desde `db/*.sql`. Todo cambio de esquema va en un archivo versionado.
