# Auditoría del proyecto bibliotecaNext — evidencias y estado

> Respuesta a `presentacion/00-guia-auditoria.md`. Hecha el 2026-11-05 en la rama `feat/mi-cuenta`
> (último commit `3567177`), revisando código, `docs/`, `db/`, `README.md` y `git log` (71 commits).
>
> **Estados:** **VERIFICABLE** = hay un archivo o commit en el repo que lo demuestra. **PARCIAL** = existe pero
> incompleto, desactualizado o solo descrito (no ejecutable). **NO EXISTE** = no hay nada en el repo.
> **PREGUNTAR A DAVID** = no se puede saber desde el repo.
>
> **Comprobado al hacer esta auditoría** (2026-11-05): `pnpm lint` → sin errores; `pnpm exec tsc --noEmit` → sin
> errores; `node scripts/contraste.ts` → "Todas las combinaciones cumplen". **No** se ejecutó la app ni la BD:
> lo que dice "probado" en `docs/estado.md` es registro del desarrollador, no una verificación de esta auditoría.

---

## 1. Información general y requerimientos

| # | Pregunta | Evidencia | Estado |
|---|---|---|---|
| 1.1 | Tipo de proyecto | Aplicación **web** (Next.js App Router + MySQL): `package.json`, `app/`, `docker-compose.yml`. Descripción en `README.md` y `docs/reglas-de-negocio.md` (D-01) | VERIFICABLE |
| 1.2 | Estado actual | `docs/estado.md`: Fases 0–5, R y A terminadas; fase "Mi cuenta y lector EPUB" en curso (R7a–R7f hechos; R7g, R7h, R7i y R8 pendientes); Fases 6–9 sin empezar. **Ojo:** `README.md` línea "Estado" sigue diciendo "Fase 4" (desactualizado) | VERIFICABLE (README desactualizado) |
| 1.7 | Funcionalidades implementadas | Ver la sección **"Funcionalidades"** más abajo, verificada en el código | VERIFICABLE |
| 1.8 | Tecnologías | `package.json`: Next.js 16.3.6, React 19.2.8, TypeScript 5, Tailwind CSS 4, mysql2 3.24, shadcn/ui + radix-ui, Hugeicons, pdfjs-dist 6.4.299, @dicebear/core 10.7.0, ESLint 9 (`eslint-config-next`). `docker-compose.yml`: MySQL 8.4. Node ≥ 22, pnpm 11.20.0 (`package.json` `engines`/`packageManager`, `README.md`). Git + GitHub (`git remote -v`) | VERIFICABLE |
| 2.1 | Cómo están documentados los requerimientos | `docs/reglas-de-negocio.md`: decisiones de alcance **D-01..D-07**, **83 reglas RN-xx** en tablas por dominio, convenciones C-01..C-05, valores iniciales y sección "Pendiente de definir". `docs/diseno.md`: decisiones de interfaz **DI-01..DI-15** y mapa del sitio con permisos por rol | VERIFICABLE |
| 2.2 | Tipos de requerimientos | **Funcionales** (RN-xx de préstamos, reservas, digital, cuentas, compras). **No funcionales** escritos como reglas: seguridad (RN-29, RN-32, RN-35, RN-62–64, RN-73, RN-80, RN-82, RN-83), concurrencia (RN-23, RN-37, RN-56), accesibilidad (DI-07, WCAG AA), configurabilidad (C-04). **Restricciones/alcance** (D-xx). No están rotulados formalmente como "funcional / no funcional" | PARCIAL (existen, sin clasificación explícita) |
| 2.3 | Cómo se identificaron o validaron las necesidades de los usuarios | En el repo solo hay decisiones "del usuario" con fecha (p. ej. RN-78, RN-79 "decidido con el usuario el 2026-11-02"; Fase 5 en `docs/estado.md`) y referencias visuales (`docs/diseno.md` → "Referencias"). No hay entrevistas, encuestas, personas ni pruebas con usuarios finales. `docs/reglas-de-negocio.md` (C-05) cita el modelo de **BD2** como antecedente | PREGUNTAR A DAVID (¿quién es "el usuario" que decide? ¿hubo usuarios reales o una biblioteca de referencia?) |
| 2.4 | Cómo verifican que lo implementado corresponde a los requerimientos | **Trazabilidad por código de regla**: el código cita la regla en comentarios (`// RN-03`). Medido: 66 de las 83 RN aparecen citadas en `lib/`, `app/`, `components/` o `scripts/`; las 17 no citadas son las de módulos pendientes (compras, traslados, auditorías: RN-15, 16, 21, 22, 36, 38–40, 42, 50–53, 57–60). Verificación manual registrada por fase en `docs/estado.md` (casos probados). **Citar una regla no prueba que esté implementada** (p. ej. RN-82 se cita como "R7g sumará la foto") | PARCIAL (trazabilidad sí; criterios de aceptación y pruebas automáticas no) |
| 2.5 | Evidencias de gestión de requerimientos | `docs/reglas-de-negocio.md`, `docs/diseno.md`, `docs/auditoria-ux.md` (UX-01..UX-12 → cómo se resuelve cada uno), `docs/estado.md` (pasos por fase), `git log` (cada commit nombra fase, paso y RN, p. ej. `30f73bc … (Mi cuenta, paso R7e, RN-80)`), "Pendiente de definir" al final de las reglas | VERIFICABLE |
| 2.6 | Enlaces a evidencias (documentos, historias de usuario, criterios de aceptación, prototipos, tableros) | Documentos: los de 2.5. **Historias de usuario:** NO EXISTE. **Criterios de aceptación** formales: NO EXISTE (las RN son precisas pero no tienen formato Dado/Cuando/Entonces). **Prototipos:** NO EXISTE en el repo (hay `/muestrario`, página de componentes solo en desarrollo: `app/(sitio)/muestrario/page.tsx`). **Tablero** (Kanban, Trello, Issues): NO EXISTE en el repo | PARCIAL · tablero/prototipos: PREGUNTAR A DAVID |

### 2.7 Matriz de estado de los requerimientos

| Grupo de requerimientos | Identificados | Documentados | Validados | Relacionados con funcionalidad | Cambios registrados |
|---|---|---|---|---|---|
| Alcance (D-01..D-07) | Sí | Sí — `reglas-de-negocio.md` | PREGUNTAR A DAVID | Sí, salvo D-05/D-06 (compras) | Sí — `git log` de `docs/` |
| Cuentas, sesión y seguridad (RN-31..35, 62–64, 70, 73, 74) | Sí | Sí | Probados a mano (`estado.md`, Fases 3–5) | Sí — `lib/sesion.ts`, `lib/actions/sesion.ts`, `lib/actions/cuenta.ts`, `lib/data/intentos.ts` | Sí (RN-74 renumerada, ver `estado.md` "Próximo paso" 3) |
| Préstamos físicos y multas (RN-02..06, 65–67, 71, 75, 76) | Sí | Sí | Probados a mano | Sí — `lib/actions/circulacion.ts`, `lib/actions/multas.ts` | Sí (RN-75 nace de un bug, commit `d88383f`) |
| Reservas físicas (RN-07..12, 68, 69, 72) | Sí | Sí | Probados a mano | Sí — `lib/actions/reservas.ts`, `lib/actions/reglas.ts` | Sí |
| Ubicación y ejemplares (RN-17..24, 47, 49) | Sí | Sí | Probados a mano; detector RN-24 = 0 | Sí — ubicar, perdidos, detector en `lib/data/tablero.ts` | Sí |
| Sedes y traslados (RN-13..16, 50–52) | Sí | Sí | No | **Parcial**: solo RN-13 (colección flotante) y RN-14 (sugeridos en el tablero). RN-15, 16, 50–52: tablas en el esquema, sin código | Sí |
| Auditorías de estante (RN-21, 53) | Sí | Sí | No | **No** (solo tablas y consulta 11 de `db/consultas.sql`) | Sí |
| Préstamo digital (RN-25..30, 44, 54–56) | Sí | Sí | Probados a mano (incl. concurrencia) | Sí — `lib/actions/digital.ts`, `lib/actions/licencias.ts`, `app/leer/[isbn]/` | Sí (RN-29 reescrita) |
| Mi cuenta (RN-77..83) | Sí | Sí | RN-77..81 y 83 probados a mano | Sí, salvo **RN-82** (foto) y tema guardado en la cuenta | Sí (RN-78, RN-79 con fecha de decisión) |
| Compras (RN-36..42, 57–61) | Sí | Sí | No | **No** (tablas en el esquema; solo la lectura de una compra digital del seed, RN-30/61) | Sí |
| Administración de la red (RN-33) | Parcial | Parcial — "Pendiente de definir" | No | Solo licencias (`/panel/red/licencias`) | — |
| Interfaz (DI-01..DI-15, UX-01..UX-12) | Sí | Sí — `diseno.md`, `auditoria-ux.md` | Contraste medido; recorrido por rol hecho por el usuario (`estado.md` R6) | Sí | Sí |

---

## 2. Arquitectura y diseño

| # | Pregunta | Evidencia | Estado |
|---|---|---|---|
| 3.1 | Tipo de arquitectura | Monolito web **en capas** con Next.js App Router (renderizado en el servidor + Server Actions), BD relacional. Descrita en `CLAUDE.md` → "Arquitectura en capas" | VERIFICABLE |
| 3.2 | Organización en módulos, componentes o capas | `app/` presentación (Server Components; Client Components solo con interacción) → `lib/actions/` lógica y reglas (Server Actions, `"use server"`) → `lib/data/` SQL parametrizado → `lib/db.ts` pool único y `enTransaccion()`. Transversales: `lib/sesion.ts` (sesión), `lib/permisos.ts` (permisos), `lib/contrasenas.ts` (scrypt). `components/` y `components/ui/` (shadcn). `db/init/*.sql` (esquema y datos). Zonas: pública, `app/(sitio)/cuenta`, `app/(sitio)/panel`, visor `app/leer` (route group, `docs/diseno.md` DI-10) | VERIFICABLE |
| 3.3 | ¿Diagramas o modelos actualizados? | Diagramas ER en **Mermaid** en `docs/modelo-datos.md` (5 bloques). Están casi al día: la tabla `intento_acceso` está descrita en la tabla de texto del bloque 2 pero **no aparece en el diagrama**. No hay diagrama de arquitectura, de componentes ni de secuencia en el repo (`.gitignore` excluye `.archify/`, lo que sugiere diagramas hechos fuera del repo) | PARCIAL · diagramas de Archify: PREGUNTAR A DAVID |
| 3.4 | Diagramas o modelos usados | Modelo entidad-relación (Mermaid `erDiagram`); modelo de datos con tabla "de dónde sale cada tabla" (regla → tabla); mapa del sitio y matriz rol × página (`docs/diseno.md`); máquinas de estado descritas en texto (RN-10, RN-16, RN-40) | VERIFICABLE (ER) / PARCIAL (estados solo en texto) |
| 3.5 | Criterios para elegir arquitectura y tecnologías | `docs/diseno.md` columna "Por qué" de DI-01..DI-15 (shadcn/Radix, cookies del tema, etc.); `docs/estado.md` Fase 3 (sesión en BD, scrypt). `CLAUDE.md`: "sin ORM", "proyecto de aprendizaje". El por qué de **Next.js + MySQL sin ORM** no está argumentado más allá de "aprendizaje" | PARCIAL · PREGUNTAR A DAVID (por qué Next.js/MySQL y no otra opción) |
| 3.6 | Evidencias de arquitectura y diseño | `docs/modelo-datos.md`, `docs/diseno.md`, `docs/auditoria-ux.md`, `CLAUDE.md`, `db/init/01_schema.sql` (42 tablas, FK, CHECK, UNIQUE), `lib/permisos.ts` | VERIFICABLE |
| 3.7 | Enlaces | Repo `git@github.com:Parzivalml-35/bibliotecaNext.git` + las rutas de 3.6. Visibilidad del repo (público o privado) | PARCIAL · visibilidad: PREGUNTAR A DAVID |
| 3.8 | SOLID, cohesión, acoplamiento | No hay una sección que lo declare. Ejemplos verificables en el código: **responsabilidad única / alta cohesión** — cada capa hace una cosa: `lib/data/*.ts` solo SQL, `lib/actions/*.ts` solo reglas, un componente nunca escribe SQL (`CLAUDE.md`). **Una sola fuente de verdad** — `lib/permisos.ts` (DI-11) la usan páginas, acciones y menú, y así se resolvió UX-01/UX-02. **Bajo acoplamiento** — `enTransaccion()` en `lib/db.ts` aísla el manejo de transacciones; los valores de negocio viven en datos (`configuracion`, `tipo_lector`, C-04), no en el código. Abierto/cerrado: el visor se planea detrás de un `<Visor formato>` (DI-06), **aún no hecho** (R8) | PARCIAL (aplicado en la práctica, no documentado como SOLID) |

### 3.9 Matriz de revisión de arquitectura y diseño

| Aspecto | Evidencia | Estado |
|---|---|---|
| Arquitectura | `CLAUDE.md` "Arquitectura en capas"; estructura real de `app/` y `lib/` coincide | VERIFICABLE |
| Módulos | `lib/actions/` (9 archivos), `lib/data/` (9), zonas de `app/` y `docs/diseno.md` DI-10 | VERIFICABLE |
| Diagramas | ER Mermaid en `docs/modelo-datos.md` (falta `intento_acceso`); sin diagrama de arquitectura ni de secuencia | PARCIAL |
| Decisiones | D-xx, DI-xx con "Por qué", decisiones fechadas en `docs/estado.md` | VERIFICABLE |
| Estructura (BD) | `db/init/01_schema.sql` (42 `CREATE TABLE`), seed reproducible, `db/consultas.sql` (12 consultas) | VERIFICABLE |

---

## 3. Calidad y pruebas

### A. Calidad del producto

| # | Pregunta | Evidencia | Estado |
|---|---|---|---|
| 4a.1 | Aspectos de calidad considerados | Seguridad (sección "Seguridad" de `CLAUDE.md`; RN de cuentas), integridad y concurrencia (transacciones con candado, RN-23; consulta detectora RN-24), accesibilidad (DI-07, contraste, teclado, `prefers-reduced-motion`), mantenibilidad (capas, TypeScript, ESLint), reproducibilidad (README, BD desde `db/*.sql`) | VERIFICABLE |
| 4a.2 | Estándar o modelo de calidad | **WCAG 2 AA** para contraste (DI-07, `scripts/contraste.ts`). No se menciona ISO/IEC 25010 ni otro modelo | PARCIAL |
| 4a.3 | Cómo verifican expectativas funcionales y no funcionales | Funcionales: pruebas manuales de punta a punta registradas en `docs/estado.md` (p. ej. Fase 3: "más de 30 casos", Fase 4: "56 casos", Fase 5 por bloque). No funcionales: contraste (script), `next build`, revisión en Chrome sin ventana, celular 390 px (R6, A5) | PARCIAL (registro escrito, sin scripts de prueba en el repo) |
| 4a.4 | ¿Usan métricas? | Contraste WCAG medido; detector RN-24 (filas incoherentes = 0); `cache()` medido con `performance_schema` (`estado.md`) | PARCIAL |
| 4a.5 | Cuáles y resultados | Contraste: **38 pares × temas sin fallos** (`estado.md` A5; re-ejecutado hoy: "Todas las combinaciones cumplen"). Detector RN-24 = 0 (`estado.md`, Fases 0, 3). Lint y tipos: 0 errores (ejecutado hoy). Sin cobertura de pruebas, Lighthouse ni tiempos de respuesta (Lighthouse planificado en la Fase 9) | PARCIAL |

### 4a.7 Matriz de atributos de calidad

| Atributo | Evidencia | Estado |
|---|---|---|
| Funcionalidad | Reglas implementadas y citadas (66/83 RN); casos manuales en `estado.md`; módulos de compras, traslados y auditorías sin código | PARCIAL |
| Rendimiento | Paginación con `LIMIT/OFFSET` (`lib/data/libros.ts`), `cache()` para no repetir consultas, índices en `01_schema.sql`, avatar con `Cache-Control: immutable`. Sin mediciones de carga ni Lighthouse | PARCIAL |
| Usabilidad | `docs/auditoria-ux.md` (12 hallazgos) y su resolución en `estado.md` R3–R6; navegación por rol; estados vacíos, carga y error; teclado y celular revisados (R6) | VERIFICABLE (revisión del propio desarrollador, sin usuarios externos) |
| Confiabilidad | Transacciones `enTransaccion()` + `UPDATE … WHERE estado =` y `FOR UPDATE/SHARE`; bug de concurrencia encontrado y corregido (`estado.md` "Bug encontrado y corregido (Fase 3)"); detector RN-24; `error.tsx` con `retry()` | VERIFICABLE |
| Seguridad | SQL parametrizado (`pool.execute`; los `${}` revisados en `lib/data/` son fragmentos fijos); scrypt (`lib/contrasenas.ts`); sesión en BD con hash del token y cookie `httpOnly`/`sameSite`/`secure` (`lib/sesion.ts`); permisos en servidor en cada página y acción (`lib/permisos.ts`, `exigirEmpleado`/`exigirLector`); límite de intentos (`lib/data/intentos.ts`); open redirect (RN-83); archivo digital fuera de `public/` (`app/leer/[isbn]/archivo/route.ts`); `.env` fuera de git. Sin revisión externa ni herramienta de análisis | VERIFICABLE (sin auditoría externa) |
| Mantenibilidad | TypeScript estricto + ESLint (0 errores hoy); capas; reglas citadas en el código; `lib/permisos.ts` como fuente única. **Sin pruebas automáticas** que protejan cambios | PARCIAL |

### B. Pruebas y seguridad

| # | Pregunta | Evidencia | Estado |
|---|---|---|---|
| 4b.1 | Tipos de pruebas realizadas | Manuales de punta a punta (formularios enviados sin JS "con un script"), permisos por rol, CSRF, concurrencia (dos préstamos / dos pedidos de la última licencia), prueba de falla (deteniendo MySQL, Fase 2 C1), contraste, visual en navegador sin ventana. Todo según `docs/estado.md`. **No hay pruebas unitarias, de integración ni E2E automatizadas en el repo** (no hay carpeta de tests ni dependencia de Jest/Vitest/Playwright en `package.json`) | PARCIAL |
| 4b.2 | Herramientas | Versionadas: ESLint, TypeScript (`tsc`), `scripts/contraste.ts`, `db/consultas.sql` (detector). Mencionadas pero **no versionadas**: el script que enviaba formularios, Chrome sin ventana (CDP), dos navegadores para sesiones | PARCIAL · scripts de prueba: PREGUNTAR A DAVID (¿dónde están?) |
| 4b.3 | Cómo registran resultados y errores | Texto en `docs/estado.md` (columna Estado y "Pendientes y avisos") y mensajes de commit `fix:`. No hay bitácora de pruebas con caso / esperado / obtenido ni gestor de incidencias (no hay `.github/`; `gh` no está instalado para revisar Issues) | PARCIAL · Issues de GitHub: PREGUNTAR A DAVID |
| 4b.4 | Evidencias de ejecución | Resúmenes en `docs/estado.md`; salida de `pnpm diseno:contraste` reproducible. No hay capturas, logs ni reportes guardados en el repo | PARCIAL |
| 4b.6 | Defectos encontrados y corrección | Verificables en el repo: (1) **tildes doblemente codificadas** → `SET NAMES utf8mb4` (commit `b949568`); (2) **carrera en préstamos**: un lector quedó con 3 de 2 préstamos por `REPEATABLE READ` → bloquear y contar con `FOR SHARE` (`estado.md`, Fase 3); (3) **licencia prestada dos veces** sin `FOR UPDATE` (`estado.md`); (4) **dos préstamos de la misma obra** → RN-75 (commit `d88383f`); (5) **contraste insuficiente** en 3 pares y portada con título de 1.4 px (commit `08e41ba`); (6) lámpara del visor (commits `35b77ef`, `396b8c8`). Avisos conocidos sin corregir en "Pendientes y avisos" | VERIFICABLE |

### 4b.7 Matriz de revisión de pruebas

| Tipo de prueba | ¿Se hizo? | Evidencia | Estado |
|---|---|---|---|
| Unitarias | No | — | NO EXISTE |
| Integración (BD) | Manual | `db/consultas.sql`, reconstrucción desde cero (`estado.md` Fase 0) | PARCIAL |
| Funcionales / punta a punta | Manual con script no versionado | `docs/estado.md` Fases 3, 4, 5, R7 | PARCIAL |
| Seguridad (permisos, CSRF, open redirect, fuerza bruta, acceso al archivo) | Manual | `docs/estado.md` Fases 3–5, R3c, R7c–R7e | PARCIAL |
| Concurrencia | Manual, dos sesiones | `docs/estado.md` Fase 3 y 5; "Verificado con dos sesiones simultáneas" | PARCIAL |
| Accesibilidad / contraste | Automatizada (script) | `scripts/contraste.ts`, `pnpm diseno:contraste` | VERIFICABLE |
| Usabilidad con usuarios | No consta | — | PREGUNTAR A DAVID |
| Rendimiento / carga | No | Lighthouse planificado (Fase 9) | NO EXISTE |
| Análisis estático | Sí | `eslint.config.mjs`, `tsconfig.json`; 0 errores el 2026-11-05 | VERIFICABLE |
| Integración continua | No | Sin `.github/workflows` | NO EXISTE |

---

## 4. Evidencias generales y reflexión

| # | Pregunta | Evidencia | Estado |
|---|---|---|---|
| 5.1 | Evidencias generales | Repo completo: código, `docs/` (5 documentos), `db/` reproducible, `README.md` de puesta en marcha, `git log` con 71 commits (2026-09-24 a 2026-11-02) que nombran fase, paso y regla | VERIFICABLE |
| 5.2 | Enlaces (repo, carpeta, demo, documentación) | Repo: `github.com/Parzivalml-35/bibliotecaNext`. Documentación: `docs/`. **Demo desplegada: NO EXISTE** (solo local; `estado.md` habla de "al desplegar" como futuro). Notas en el vault de Obsidian ("Biblioteca Next", citadas en `estado.md`) están fuera del repo | PARCIAL · demo y carpeta compartida: PREGUNTAR A DAVID |
| 5.3 | Fortalezas técnicas | Reglas de negocio como fuente de verdad y citadas en el código; integridad con transacciones y candados probados en concurrencia; consulta detectora (RN-24); seguridad de cuentas cuidada (scrypt, sesión revocable, límite de intentos, enlaces de un solo uso con hash, misma respuesta para no revelar cuentas, open redirect); permisos desde una sola fuente; BD reconstruible desde `db/*.sql`; contraste medido por script | VERIFICABLE |
| 5.4 | Limitaciones y problemas actuales | Sin pruebas automáticas ni CI; compras, traslados, auditorías y administración de la red sin código; pago simulado que **confirma el propio lector con un botón** (`confirmarPagoSimulado` en `lib/actions/multas.ts`, documentado como simulación); correo simulado en consola; límite por IP evadible sin proxy (`estado.md`); correos "enviados" aunque la transacción haga ROLLBACK; logo provisional; README desactualizado; sin despliegue | VERIFICABLE |
| 5.5 | Áreas a mejorar | Pruebas automatizadas, CI, despliegue, módulos pendientes, diagramas de arquitectura/secuencia, criterios de aceptación formales. Lo que el propio repo prioriza: `docs/estado.md` → "Próximo paso" | VERIFICABLE (lo planificado) · prioridades propias: PREGUNTAR A DAVID |
| 5.6 | Problema técnico importante y aprendizaje | Mejor documentado: **carrera de préstamos simultáneos** (`estado.md`, "Bug encontrado y corregido (Fase 3)"): bajo `REPEATABLE READ`, contar con subconsultas normales no ve lo confirmado por otra transacción mientras se espera un candado; solución: bloquear primero y contar con `FOR SHARE`. Alternativa: RN-75 (commit `d88383f`) | VERIFICABLE · el relato personal: PREGUNTAR A DAVID |
| 5.7 | Mejoras para la siguiente versión | Planificado en `docs/estado.md` "Próximo paso": R7g–R7i y R8 (lector EPUB), Fase 6 compras + pasarela con firma HMAC, Fase 7 administración, Fase 8 traslados y auditorías, Fase 9 calidad | VERIFICABLE · el porqué del orden: PREGUNTAR A DAVID |

### 5.8 Matriz de disponibilidad de evidencias

| Evidencia | Dónde | Estado |
|---|---|---|
| Requerimientos | `docs/reglas-de-negocio.md`, `docs/diseno.md` (sin historias de usuario ni criterios de aceptación formales) | PARCIAL |
| Arquitectura | `CLAUDE.md`, `docs/modelo-datos.md` (ER), `docs/diseno.md` (sin diagrama de arquitectura) | PARCIAL |
| Código fuente | `app/`, `lib/`, `components/`, `db/`, `scripts/` (≈ 9.100 líneas TS/TSX, ≈ 1.500 de SQL) | VERIFICABLE |
| Pruebas | Registro manual en `docs/estado.md`; solo `scripts/contraste.ts` ejecutable | PARCIAL |
| Calidad | `scripts/contraste.ts`, ESLint, TypeScript, detector RN-24, `docs/auditoria-ux.md` | PARCIAL |
| Seguridad | Sección "Seguridad" de `CLAUDE.md`, RN de cuentas, código en `lib/sesion.ts`, `lib/permisos.ts`, `lib/contrasenas.ts`, `lib/data/intentos.ts` (sin informe de pruebas de seguridad) | PARCIAL |
| Manuales | `README.md` = manual de instalación para desarrolladores (con cuentas de prueba). **Manual de usuario: NO EXISTE** | PARCIAL |

---

## Funcionalidades (verificadas en el código)

### Funcionando (hay página o ruta + Server Action + SQL)

| Funcionalidad | Dónde |
|---|---|
| Catálogo con búsqueda por título/autor, filtro por sección y paginación | `app/(sitio)/page.tsx`, `components/buscador-catalogo.tsx`, `lib/data/libros.ts` |
| Ficha del libro con disponibilidad por sede y ubicación | `app/(sitio)/libros/[isbn]/page.tsx` |
| Registro con verificación por correo (simulado en consola), datos obligatorios RN-74 | `app/(sitio)/registro`, `app/(sitio)/verificar`, `lib/actions/cuenta.ts` (`registrarLector`, `verificarCorreo`) |
| Inicio y cierre de sesión, sesión en BD, límite de intentos, `?siguiente=` seguro | `app/(sitio)/login`, `lib/actions/sesion.ts`, `lib/sesion.ts`, `lib/data/intentos.ts` |
| Reservas físicas (asignación inmediata o cola) y cancelación | `lib/actions/reservas.ts` |
| Mi cuenta: resumen, préstamos y reservas, digitales, multas, aviso "por vencer" | `app/(sitio)/cuenta/{page,prestamos,digitales,multas}` |
| Pago de multas en línea (pasarela **simulada**) | `app/(sitio)/cuenta/pago/[id]`, `lib/actions/multas.ts` |
| Perfil: editar contacto (RN-77) | `app/(sitio)/cuenta/perfil`, `actualizarContacto` |
| Seguridad: cambiar contraseña (RN-78) y correo (RN-79) | `app/(sitio)/cuenta/seguridad`, `app/(sitio)/confirmar-correo`, `cambiarContrasena`, `solicitarCambioCorreo`, `confirmarCambioCorreo` |
| Recuperar contraseña (RN-80) | `app/(sitio)/recuperar`, `app/(sitio)/restablecer`, `solicitarRecuperacion`, `restablecerContrasena` |
| Avatar generado DiceBear (RN-81) | `app/avatar/[estilo]/[semilla]/route.ts`, `lib/actions/avatar.ts` |
| Mostrador: préstamo, devolución con multa, renovación, préstamos abiertos | `app/(sitio)/panel/mostrador/*`, `lib/actions/circulacion.ts` |
| Lectores: buscar, validar en mostrador, cobrar y anular multas | `app/(sitio)/panel/lectores`, `validarLector`, `cobrarMulta`, `anularMultaConMotivo` |
| Colección: ubicar ejemplares y declarar perdidos | `app/(sitio)/panel/coleccion/{ubicar,perdidos}`, `ubicarEjemplar`, `declararPerdido` |
| Reportes: indicadores, traslados **sugeridos** y detector RN-24 | `app/(sitio)/panel/reportes`, `lib/data/tablero.ts` |
| Préstamo digital: pedir, reservar, cola, devolver; visor PDF sin descarga | `lib/actions/digital.ts`, `app/leer/[isbn]/`, `components/visor-pdf.tsx` |
| Licencias digitales: ver uso por lote y registrar lotes (admin de red) | `app/(sitio)/panel/red/licencias`, `lib/actions/licencias.ts` |
| Panel con menú y redirección según el rol; tres temas y lámpara | `lib/permisos.ts`, `components/panel/*`, `lib/tema.ts`, `components/boton-tema.tsx`, `components/boton-lampara.tsx` |

### Parcial

| Funcionalidad | Qué hay / qué falta |
|---|---|
| Compras digitales | La lectura reconoce una compra (`app/leer/[isbn]/archivo/route.ts`, `lib/data/digital.ts`) y marca la primera lectura (RN-61), pero **no hay forma de comprar**: las compras salen del seed |
| Traslados | Solo los **sugeridos** (RN-14) en Reportes; confirmar, despachar y recibir (RN-15, 16, 50–52) no existen. Tablas en `01_schema.sql` |
| Avatar y preferencias de la cuenta | Generado sí; foto (RN-82, R7g) no; columnas `tema_base` y `lampara` en `cuenta` sin código que las use (R7h) |
| Pasarela de pago | Simulada con un botón que pulsa el propio lector; la notificación firmada (HMAC) es Fase 6 |
| Correo | Se escribe en la consola del servidor (`enviarCorreo` en `lib/actions/reglas.ts`); sin proveedor real |
| Administración de la red | Solo licencias; subir PDF desde el panel pendiente (`estado.md` Fase 9) |

### Pendiente (sin código)

| Funcionalidad | Referencia |
|---|---|
| Compras físicas y digitales: carrito, pedido, stock, envío, devoluciones (RN-36..42, 57–60) | Fase 6; tablas en `01_schema.sql` (bloque 5) |
| Auditorías de estante (RN-21, RN-53) | Fase 8 |
| Administración: empleados, catálogo, tipos de lector, configuración | Fase 7; preguntas abiertas en "Pendiente de definir" |
| Perfil del empleado `/panel/perfil` (R7i) | `docs/diseno.md` DI-10 |
| Lector EPUB con foliate-js (R8) | `docs/diseno.md` DI-06 |
| Recuperar un ejemplar declarado perdido | `docs/estado.md` "Próximo paso" 6 |
| Logo e íconos definitivos | `components/marca/iconos.tsx` (provisional) |

---

## 5. Cierre

| # | Pregunta | Respuesta | Estado |
|---|---|---|---|
| 6.1 | ¿La información refleja el estado actual? | `docs/estado.md` coincide con el código revisado (R7a–R7f hechos, R7g–R8 pendientes). Desfases encontrados: `README.md` dice "Fase 4"; la línea "Última actualización" de `estado.md` dice 2026-11-01 pero describe trabajo del 2026-11-02; `docs/diseno.md` prevé `/recuperar?token=` y el código usa `/restablecer`; el diagrama ER no incluye `intento_acceso`; `presentacion/` no está en git | PARCIAL |
| 6.2 | Observaciones adicionales | Un solo autor en `git log` (`Parzivalml-35`, 71 commits). `CLAUDE.md` muestra que se trabaja con un asistente de IA (Claude Code) como tutor; conviene decidir cómo se presenta eso | PREGUNTAR A DAVID (equipo, rol de la IA, contexto académico) |

---

## Brechas ordenadas por impacto y esfuerzo

Impacto = cuánto mejora la respuesta ante los auditores. Esfuerzo estimado (B bajo, M medio, A alto). Primero las de
impacto alto y esfuerzo bajo.

| # | Brecha | Impacto | Esfuerzo | Qué hacer |
|---|---|---|---|---|
| 1 | Resolver las preguntas "PREGUNTAR A DAVID" (validación con usuarios, demo, tablero, scripts de prueba, equipo) | Alto | B | Responderlas y anotarlas aquí |
| 2 | README desactualizado ("Fase 4") y fecha de `estado.md` | Alto (6.1) | B | Actualizar la línea de estado |
| 3 | Sin matriz de trazabilidad explícita RN → archivo → prueba | Alto (2.4, 2.7) | B–M | Generarla a partir de `grep RN-` (ya medido: 66/83) |
| 4 | Scripts de prueba manual no versionados | Alto (4b) | B–M | Si existen, agregarlos a `scripts/`; si no, reescribir los casos clave |
| 5 | Sin diagrama de arquitectura ni de secuencia; ER sin `intento_acceso` | Medio–Alto (3.3) | B–M | Diagrama de capas y una secuencia (p. ej. préstamo con transacción); completar el ER |
| 6 | Sin bitácora de pruebas (caso / esperado / obtenido) | Medio–Alto (4b.3, 4b.4) | M | Pasar los casos de `estado.md` a una tabla con resultados |
| 7 | Requerimientos sin clasificar (funcional / no funcional) ni criterios de aceptación | Medio (2.2, 2.6) | M | Etiquetar las RN y escribir criterios para las principales |
| 8 | Sin pruebas automáticas ni CI | Alto | A | Pruebas de las reglas críticas (préstamo, RN-75, permisos, RN-83) y un workflow con lint + tsc + build |
| 9 | Sin demo desplegada | Medio–Alto (5.2) | M–A | Requiere proxy con IP real (RN-73) y decidir el correo |
| 10 | Sin manual de usuario | Medio (5.8) | M | Guía corta por rol (lector, bibliotecario, coordinador, admin) |
| 11 | Sin métricas de rendimiento ni modelo de calidad formal | Medio (4a.2, 4a.5) | M | Lighthouse (Fase 9) y relacionar los atributos con ISO/IEC 25010 |
| 12 | Módulos sin código: compras, traslados, auditorías, administración | Alto para el producto, bajo para la auditoría si se presentan como pendientes | A | Seguir el plan de `estado.md` |
