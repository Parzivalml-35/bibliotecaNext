# Ficha técnica — bibliotecaNext

> Datos tomados del código el 2026-11-19 (rama `main`, commit `b37cfe9`). Para la exposición de Programación Web.

## 1. Identificación

| Campo | Valor |
|---|---|
| Nombre | bibliotecaNext |
| Tipo | Aplicación web full-stack (renderizada en el servidor) |
| Dominio | Red de bibliotecas: catálogo con ubicación física, préstamos, reservas, préstamo digital y comunidad de lectores |
| Usuarios | Visitante, lector, bibliotecario, coordinador de sede, administrador de red |
| Repositorio | `github.com/Parzivalml-35/bibliotecaNext` |
| Inicio / último cambio | 2026-09-24 / 2026-11-19 (115 commits) |
| Naturaleza | Proyecto de aprendizaje: reglas de negocio escritas antes del código, construcción por fases |

## 2. Tecnologías (versiones reales de `package.json` y `docker-compose.yml`)

| Capa | Tecnología | Versión | Para qué |
|---|---|---|---|
| Framework web | **Next.js** (App Router, Turbopack) | 16.3.6 | Rutas por carpetas, Server Components, Server Actions, Route Handlers |
| Biblioteca de UI | **React** | 19.2.8 | Componentes, `useActionState`, `useTransition`, `cache()` |
| Lenguaje | **TypeScript** | 5 | Tipos en todo el proyecto (uso simple) |
| Estilos | **Tailwind CSS** | 4 | Clases utilitarias; tokens de color en `app/globals.css` |
| Componentes base | **shadcn/ui** sobre **Radix UI** | shadcn 4.22 / radix-ui 1.8 | Botón, tarjeta, insignia, diálogo, menú desplegable, panel lateral (`components/ui/`) |
| Íconos | Hugeicons + SVG propios | 4.3 | Íconos de interfaz; marca propia en `components/marca/` |
| Base de datos | **MySQL** en Docker | 8.4 | 51 tablas, puerto 3307 en el equipo |
| Acceso a datos | **mysql2/promise**, SQL a mano, **sin ORM** | 3.24 | Pool único y transacciones (`lib/db.ts`) |
| Lector digital | foliate-js (EPUB) y pdfjs-dist (PDF) | 1.0.1 / 6.4.299 | Visor inmersivo en `/leer/[isbn]` |
| Imágenes | sharp, DiceBear | 0.35.4 / 10.7 | Foto de perfil recortada; avatares generados |
| Seguridad | `node:crypto` (scrypt, SHA-256, `randomBytes`) | Node 22 | Contraseñas, tokens, nonce de CSP |
| Herramientas | pnpm, ESLint 9 (`eslint-config-next`), Git + GitHub, Docker Compose | pnpm 11.20, Node ≥ 22 | Paquetes, lint, versiones, BD reproducible |

## 3. Arquitectura

Monolito web **en capas**, renderizado en el servidor:

```text
Navegador ──HTTP──▶ Next.js (servidor Node)
                     ├─ proxy.ts              CSP con nonce (solo /leer/:isbn)
                     ├─ app/                  PRESENTACIÓN: páginas y layouts (Server Components)
                     │    └─ components/      Client Components solo donde hay interacción
                     ├─ lib/actions/          LÓGICA: Server Actions ("use server"), validan y aplican reglas RN-xx
                     ├─ lib/data/             DATOS: SQL parametrizado
                     └─ lib/db.ts             pool mysql2 único + enTransaccion()
                                    │
                                    ▼
                              MySQL 8.4 (Docker)
```

Regla de la arquitectura: **un componente nunca escribe SQL**. Transversales: `lib/sesion.ts` (sesión),
`lib/permisos.ts` (permisos por rol, única fuente), `lib/contrasenas.ts` (scrypt).

## 4. Estructura de carpetas

| Carpeta | Contenido |
|---|---|
| `app/(sitio)/` | Route group con la barra superior: catálogo, ficha, login/registro, `cuenta/*`, `panel/*` |
| `app/leer/[isbn]/` | Visor inmersivo (fuera del grupo: sin barra de la app) y sus Route Handlers |
| `app/avatar/` | Route Handlers que sirven avatares y fotos |
| `components/` | 68 componentes (`ui/` de shadcn, `panel/`, `cuenta/`, `resenas/`, `visor-epub/`, `marca/`) |
| `lib/actions/` | 15 archivos de Server Actions |
| `lib/data/` | 13 archivos de consultas SQL |
| `db/init/` | `01_schema.sql`, `02_seed.sql`, `03_catalogo_simulado.sql` (se ejecutan al crear el volumen) |
| `docs/` | Reglas de negocio, modelo de datos, diseño, estado, auditoría UX |
| `scripts/` | `claves-dev.ts`, `archivos-muestra.ts`, `contraste.ts` |
| `storage/` | Libros digitales y fotos, **fuera de `public/`** y de git |

## 5. Cifras

| Elemento | Cantidad |
|---|---|
| Páginas (`page.tsx`) | 30 |
| Layouts | 5 |
| Route Handlers (`route.ts`) | 4 |
| Archivos especiales (`loading`, `error`, `not-found`) | 6 |
| Archivos con `"use client"` / `"use server"` | 53 / 15 |
| Tablas / bloques del modelo | 51 / 7 |
| Reglas de negocio (RN-xx) / decisiones de interfaz (DI-xx) | 95 / 17 |
| Libros en el catálogo de prueba | 112 (16 reales + 96 simulados) |
| Temas visuales | 3 (claro, oscuro, lámpara) |

## 6. Mapa del sitio y roles

| Zona | Rutas | Quién |
|---|---|---|
| Pública | `/` (catálogo), `/libros/[isbn]`, `/login`, `/registro`, `/verificar`, `/recuperar`, `/restablecer` | Cualquiera |
| Mi cuenta | `/cuenta`, `/cuenta/prestamos`, `/cuenta/digitales`, `/cuenta/lecturas`, `/cuenta/multas`, `/cuenta/perfil`, `/cuenta/seguridad`, `/cuenta/pago/[id]` | Lector con sesión |
| Lectura | `/leer/[isbn]` | Lector con préstamo digital vigente o compra |
| Panel: Mostrador | `/panel/mostrador`, `/prestamo`, `/devolucion` | Bibliotecario, coordinador |
| Panel: Lectores | `/panel/lectores`, `/panel/lectores/resenas` | Todos los empleados |
| Panel: Colección | `/panel/coleccion/ubicar`, `/perdidos` | Bibliotecario, coordinador |
| Panel: Reportes | `/panel/reportes` | Coordinador (su sede), admin (la red) |
| Panel: Red | `/panel/red/licencias` | Administrador de red |

El menú y la verificación leen la misma tabla de permisos (`lib/permisos.ts`); `/panel` redirige a la primera sección del rol.

## 7. Funcionalidades

**Hechas:** catálogo con búsqueda en vivo, filtro y paginación · ficha con disponibilidad por sede y ubicación ·
registro con verificación por correo (simulado en consola) · inicio de sesión con límite de intentos · reservas
físicas con cola · Mi cuenta (préstamos, digitales, multas, perfil, avatar o foto, seguridad, recuperar contraseña,
tema guardado) · pago de multas con pasarela **simulada** · préstamo digital con licencias y cola · visor PDF y EPUB
con anotaciones, notas, historial y posición de lectura · notificaciones con campana, apodo público, encuesta al
terminar un libro, reseñas y moderación · panel: préstamo, devolución con multa, renovación, validar lectores,
cobrar y anular multas, ubicar ejemplares, perdidos, tablero de indicadores, licencias.

**Pendientes:** ver la sección 10.

## 8. Seguridad

| Riesgo | Medida | Dónde |
|---|---|---|
| Inyección SQL | Solo `pool.execute(sql, [params])` | `lib/data/*.ts` |
| Robo de sesión / XSS | Cookie `httpOnly`, `sameSite=lax`, `secure` en producción; la BD guarda el SHA-256 del token | `lib/sesion.ts` |
| CSRF | Server Actions solo por POST y Next compara `Origin` con `Host`; cookie `sameSite=lax` | Next + `lib/sesion.ts` |
| Contraseñas | scrypt (N=2^17, parámetros de OWASP), mismo tiempo de respuesta si el correo no existe | `lib/contrasenas.ts`, `lib/actions/sesion.ts` |
| Fuerza bruta | Límite de fallos por correo y por IP antes de calcular scrypt (RN-73) | `lib/data/intentos.ts` |
| Permisos | Verificados en el servidor en cada página y acción (RN-35) | `exigirEmpleado()` en `lib/sesion.ts`, `lib/permisos.ts` |
| JavaScript dentro de un EPUB | CSP con nonce y `strict-dynamic` en el visor | `proxy.ts` |
| Descarga de libros | Archivos en `storage/`, servidos por un Route Handler tras verificar sesión y acceso; `no-store`, `nosniff`, `Sec-Fetch-*` | `app/leer/[isbn]/archivo/[formato]/route.ts` |
| Secretos | `.env` fuera de git; `.env.example` con valores de ejemplo | raíz |
| Concurrencia | Transacciones con `SELECT … FOR UPDATE` en un orden fijo | `lib/db.ts`, `lib/actions/circulacion.ts` |

## 9. Cómo ejecutarlo

```bash
cp .env.example .env              # y cambiar contraseñas
docker compose up -d --wait       # MySQL 8.4 en 127.0.0.1:3307, ejecuta db/init/*.sql
pnpm install
pnpm db:claves-dev                # contraseña de desarrollo para las cuentas de prueba
pnpm archivos:muestra             # PDF y EPUB de muestra en storage/libros/
pnpm dev                          # http://localhost:3000
```

Comprobaciones: `pnpm lint`, `pnpm build`, `pnpm diseno:contraste` (contraste WCAG AA de los tres temas).

## 10. Pendiente para dejarlo completo

| Pendiente | Qué aporta |
|---|---|
| Compras físicas y digitales (carrito, pedido, stock, envío) | Cierra el bloque 5 del modelo (las tablas ya existen) |
| Pasarela de pago real con notificación firmada (HMAC) | Hoy el pago se confirma con un botón; un Route Handler verificaría la firma del proveedor |
| Administración de la red (empleados, catálogo, tipos de lector, configuración) | Hoy esos datos solo se cambian en el seed |
| Traslados entre sedes y auditorías de estante | Hoy solo se *sugieren* traslados en el tablero |
| Subir PDF y EPUB desde el panel | Hoy los archivos se generan con un script |
| Recuperar un ejemplar declarado perdido | Falta decidir la regla de su multa |
| Foro por libro | Reglas por decidir |
| Calidad: pruebas automáticas, Lighthouse, CSP en todo el sitio | Hoy las pruebas son manuales y con scripts |
| Correo real y despliegue (HTTPS, servidor) | Hoy el correo sale por consola y corre en local |

## 11. Documentación de referencia

| Documento | Contenido |
|---|---|
| `docs/reglas-de-negocio.md` | Reglas RN-xx, decisiones D-xx, convenciones C-xx |
| `docs/modelo-datos.md` | 7 bloques con diagramas ER (Mermaid) y de qué regla sale cada tabla |
| `docs/diseno.md` | Decisiones DI-xx, temas, mapa del sitio y permisos |
| `docs/estado.md` | Fases, pasos y pendientes |
| `db/consultas.sql` | Consultas clave para ejecutar a mano |
