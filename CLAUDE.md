# CLAUDE.md — bibliotecaNext

Reglas de este proyecto. Complementan el `CLAUDE.md` global y tienen prioridad sobre él.

## Qué es

Sistema para una red de bibliotecas (catálogo con ubicación física, préstamos, reservas, préstamo digital,
compras). **Proyecto de aprendizaje**: el objetivo principal es que el usuario entienda lo que se construye,
no terminar rápido.

## Fuentes de verdad

1. `docs/reglas-de-negocio.md`: cómo funciona el sistema. Reglas `RN-xx`, decisiones `D-xx`, convenciones `C-xx`.
2. `docs/modelo-datos.md`: tablas derivadas de las reglas; cada una cita sus reglas.
3. `docs/estado.md`: fase y paso actual. **Leerlo al empezar cada sesión.**

Si una regla no cubre un caso, no inventarla: preguntar, decidir con el usuario y agregarla al documento.
El modelo de Bases de datos 2 del vault es solo contexto histórico; no es la especificación.

## Stack

- Next.js App Router + TypeScript (uso simple) + Tailwind CSS
- MySQL 8 en Docker, SQL escrito a mano con `mysql2`, **sin ORM**
- pnpm; Node 22 LTS

## Arquitectura en capas

```text
app/            presentación: Server Components leen; Client Components solo donde hay interacción
lib/actions/    lógica: Server Actions validan y aplican las reglas (citar RN-xx en comentarios)
lib/data/       datos: SQL parametrizado
lib/db.ts       pool mysql2 único
db/             schema.sql, seed.sql, consultas.sql
```

Un componente nunca escribe SQL.

## Forma de trabajo

- Pasos pequeños: **concepto → construcción → verificación → commit**. Explicar el porqué, relacionándolo
  con lo que el usuario ya conoce (Pages Router del curso Next.js Learn).
- Dejar las partes repetitivas como ejercicio para el usuario y revisarlas después.
- Commits y push **solo con confirmación** del usuario; un commit por paso.
- Al terminar una sesión: actualizar `docs/estado.md`. Al cerrar una fase: sugerir `/documentar`
  (nota del proyecto `Biblioteca Next` y notas de las materias a las que toque la fase).

## Convenciones

- BD: `snake_case`, minúscula, singular; claves `id_<tabla>` (C-01). Estados como ENUM; catálogos editables en tablas (C-02).
- Límites, plazos y montos en datos (`tipo_lector`, `configuracion`), nunca escritos en el código (C-04).
- Toda operación que cambie el estado de un ejemplar, stock o licencia va en **una transacción**
  con el candado definido en las reglas (RN-23, RN-37, RN-56).

## Seguridad

- Siempre `pool.execute(sql, [params])`; nunca interpolar entradas en SQL.
- `.env` fuera de git; `.env.example` con todas las variables y valores de ejemplo.
- Contraseñas con hash; tokens guardados como hash (RN-32).
- Permisos verificados en el servidor en cada operación (RN-35).
- Archivos de libros digitales fuera de `public/`, servidos solo tras verificar el acceso (RN-29).

## Dos equipos

El usuario trabaja en un portátil y un PC de escritorio. El repo debe bastar para levantar el proyecto desde
cero (ver README). La BD se reconstruye desde `db/*.sql`; nunca cambiar el esquema solo a mano.
En el portátil, el puerto 3306 lo ocupa otro contenedor: MySQL de este proyecto usa el 3307.
