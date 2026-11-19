# Posibles preguntas — bibliotecaNext (Programación Web)

> Cada respuesta tiene una versión **para decir** (corta) y **dónde se ve** en el código, por si piden mostrarlo.
> Las rutas y nombres están verificados en el repo (2026-11-19).

## 1. Fundamentos de la web

**¿Es una aplicación cliente-servidor? ¿Dónde está cada parte?**
Sí. El servidor es Node.js ejecutando Next.js; el cliente es el navegador. Casi todo se ejecuta en el servidor y el
navegador recibe HTML listo; solo los componentes interactivos mandan JavaScript.
*Dónde:* `app/` (servidor), archivos con `"use client"` en `components/` (navegador).

**¿Qué diferencia hay entre GET y POST en tu proyecto?**
GET para leer: el catálogo, la ficha, la búsqueda (`/?q=garcia&pagina=2`); se puede guardar en marcadores. POST para
cambiar algo: todo formulario que llama a una Server Action (préstamo, reserva, login). Hasta "Salir" es POST, para
que un enlace o una imagen de otro sitio no pueda cerrarte la sesión.
*Dónde:* `components/buscador-catalogo.tsx` (GET), `lib/actions/sesion.ts` → `salir()` (POST).

**¿Qué es SSR, CSR y estático? ¿Cuál usas?**
SSR: el servidor arma el HTML en cada petición. CSR: el navegador arma la página con JavaScript. Estático: el HTML se
genera al compilar. Uso SSR casi siempre, porque las páginas dependen de la sesión y de datos que cambian
(disponibilidad); páginas sin datos pueden quedar estáticas, y Next lo decide solo.

**¿Qué es la hidratación?**
El servidor manda HTML; luego React "conecta" los eventos (clics, escritura) a ese HTML en el navegador. Solo pasa en
los Client Components.

**¿Qué es el streaming?**
El servidor manda la página por partes: primero lo que está listo y un esqueleto, y después lo que tarda.
*Dónde:* `app/(sitio)/loading.tsx`, `app/(sitio)/libros/[isbn]/loading.tsx`, y `<Suspense>` en el menú de usuario.

**¿Cómo funcionan las cookies en tu app?**
Tres usos: la sesión (`sesion`, `httpOnly`), el tema (`tema` y `lampara`, legibles por JavaScript porque las lee un
script del `<head>` para pintar la página sin parpadeo). Ninguna guarda datos personales.
*Dónde:* `lib/sesion.ts` (`crearSesion`, `ponerCookiesDeTema`), `lib/tema.ts`.

**¿Qué códigos HTTP devuelves?**
200 normal; 404 con `notFound()` (libro inexistente) y en el archivo del libro cuando no hay acceso (la misma respuesta
para todos los casos, para no revelar qué existe); 403 si piden el archivo fuera del visor; redirecciones con
`redirect()` tras una acción o si no hay sesión.
*Dónde:* `app/leer/[isbn]/archivo/[formato]/route.ts`, `app/(sitio)/not-found.tsx`.

## 2. Next.js App Router

**¿Por qué Next.js y no React solo, o PHP?**
Porque en un solo proyecto tengo frontend y backend con el mismo lenguaje, rutas por carpetas y renderizado en el
servidor. Con React solo tendría que hacer una API aparte. Además era lo que estaba aprendiendo (curso Next.js Learn).

**¿Qué es un Server Component y un Client Component?**
Server Component (por defecto): corre en el servidor, puede ser `async`, consultar la BD y leer cookies; no tiene
estado ni eventos. Client Component (`"use client"`): corre también en el navegador, puede usar `useState`, `onClick`,
etc. Regla: Client solo donde hay interacción.
*Ejemplo:* `app/(sitio)/page.tsx` (servidor, consulta el catálogo) usa `components/buscador-catalogo.tsx` (cliente).

**¿Qué es una Server Action?**
Una función con `"use server"` que se pasa al `action` de un `<form>`. Next crea por debajo un endpoint POST; yo no
escribo la API. Recibe un `FormData`, valida, aplica reglas y devuelve un estado o redirige.
*Dónde:* `lib/actions/circulacion.ts` → `prestarEjemplar`.

**¿Y si el usuario no tiene JavaScript?**
Sigue funcionando: el formulario hace un POST normal y el servidor responde con la página. Lo probé enviando
formularios con un script, sin navegador. Eso es **mejora progresiva**.

**¿Qué hace `useActionState`?**
Conecta un formulario con una Server Action y guarda lo que devuelve (un error, los valores escritos) para mostrarlo
sin perder lo que el usuario tecleó. También da `pending` para deshabilitar el botón.
*Dónde:* `components/formulario-login.tsx`.

**¿Qué es un Route Handler?**
El equivalente de `pages/api`: un `route.ts` que devuelve un `Response`, no una página. Lo uso donde no hay HTML:
entregar el PDF/EPUB, los avatares y el "latido" del lector (tiempo leído).
*Dónde:* `app/leer/[isbn]/archivo/[formato]/route.ts`, `app/avatar/[estilo]/[semilla]/route.ts`, `app/leer/[isbn]/latido/route.ts`.

**¿Qué es `(sitio)` en la carpeta?**
Un *route group*: los paréntesis no aparecen en la URL. Sirve para que esas páginas compartan un layout con la barra
superior, y que `/leer` quede fuera, a pantalla completa.

**¿Qué es `proxy.ts`?**
El antiguo `middleware.ts` (en Next 16 se renombró). Corre antes de renderizar la ruta. Lo uso solo en `/leer/:isbn`
para poner la política de seguridad (CSP) con un *nonce* distinto en cada petición.

**¿Cómo se actualiza la página después de una acción?**
Con `revalidatePath()` (vuelve a renderizar la ruta con datos nuevos) o `redirect()`.
*Dónde:* `lib/actions/reglas.ts`.

**¿Qué pasa si se cae la base de datos?**
`app/(sitio)/error.tsx` muestra un mensaje con un botón de reintentar; lo probé deteniendo MySQL.

**¿Para qué usas `useTransition` en el buscador?**
Para que cambiar la URL (que dispara la búsqueda en el servidor) no bloquee la escritura, y para mostrar "buscando".
Además, *debounce* de 300 ms: solo busca cuando dejas de escribir.

## 3. Sesión y permisos

**¿Cómo funciona el login?**
La acción valida el correo y la contraseña (scrypt), crea un token aleatorio de 32 bytes, guarda **su SHA-256** en la
tabla `sesion` y manda el token en una cookie `httpOnly`. En cada petición, `obtenerUsuario()` lee la cookie, calcula
el hash y busca la sesión vigente.
*Dónde:* `lib/actions/sesion.ts` → `iniciarSesion`, `lib/sesion.ts` → `crearSesion`, `obtenerUsuario`.

**¿Por qué sesión en la BD y no JWT?**
Porque puedo cerrarla de verdad: al salir o al desactivar una cuenta se borra la fila y queda fuera en la siguiente
petición. Con un JWT habría que esperar a que venza.

**¿Por qué guardas el hash del token y no el token?**
Si alguien lee la tabla (un respaldo, una inyección), no puede usar esos valores para entrar.

**¿Cómo controlas qué ve cada rol?**
`lib/permisos.ts` es la única tabla de permisos. La usa el menú (para mostrar) y `exigirEmpleado()` (para
verificar). Cada página **y cada acción** lo verifica en el servidor: ocultar un botón no es seguridad, porque se
puede enviar el formulario a mano.

**¿Por qué no verificas el permiso solo en el layout?**
Porque un layout no se vuelve a ejecutar al navegar entre sus páginas, y una Server Action se puede llamar sin pasar
por el layout. La guía de autenticación de Next lo dice así.

**¿`cache()` para qué sirve en `obtenerUsuario`?**
Dentro de una misma petición, el layout, la página y los componentes la llaman varias veces y la BD se consulta una
sola vez.

## 4. Seguridad web

**¿Cómo evitas la inyección SQL?**
Siempre consultas parametrizadas: `pool.execute(sql, [params])`. El valor viaja aparte del texto SQL, nunca se
concatena.
*Dónde:* cualquier archivo de `lib/data/`.

**¿Y XSS?**
React escapa todo lo que se pinta con `{}`. El único `dangerouslySetInnerHTML` está en
`components/script-en-linea.tsx` y pinta el script fijo del tema (texto del código, nunca datos de usuarios). La cookie de
sesión es `httpOnly`, así que aunque hubiera un XSS no la podría leer. En el visor, un EPUB es HTML y puede traer
`<script>`: la CSP de `proxy.ts` solo deja correr scripts con el nonce de la petición (`strict-dynamic`).

**¿Y CSRF?**
Las Server Actions solo aceptan POST y Next compara la cabecera `Origin` con `Host`: si no coinciden, rechaza la
petición (guía `data-security.md` de Next). Además la cookie es `sameSite=lax`. Lo probé en la verificación de la
Fase 3.

**¿Cómo guardas las contraseñas?**
Con **scrypt** (incluido en Node), parámetros de OWASP (N=2^17), con sal aleatoria. Tarda ~300 ms a propósito. Si
el correo no existe igual calculo un scrypt, para que el tiempo de respuesta no revele qué correos tienen cuenta.
*Dónde:* `lib/contrasenas.ts`, `lib/actions/sesion.ts`.

**¿Y si alguien prueba contraseñas sin parar?**
Límite de fallos por correo y por IP en una ventana de tiempo (RN-73), revisado **antes** de calcular scrypt.
*Dónde:* `lib/data/intentos.ts`.

**¿Se pueden descargar los libros digitales?**
No están en `public/`. Los entrega un Route Handler que verifica sesión y préstamo vigente o compra, valida el nombre
del archivo contra *path traversal* (`../`) y manda `no-store` y `nosniff`. También rechaza abrir la URL desde la barra
de direcciones (`Sec-Fetch-Dest`). Límite honesto: lo que el navegador muestra se puede capturar; la protección real es
la sesión.

**¿Dónde están las contraseñas de la BD?**
En `.env`, que no va a git. En el repo hay un `.env.example` con valores de ejemplo.

**¿Los datos de prueba son reales?**
Los libros sí (ISBN reales); las personas son ficticias, con correos `@example.com`, un dominio reservado para ejemplos.

## 5. Frontend: estilos, componentes y accesibilidad

**¿Por qué Tailwind?**
Escribo los estilos junto al componente con clases pequeñas (`flex`, `gap-4`, `rounded-lg`) y Tailwind genera solo
el CSS que se usa. Los colores son variables CSS (*tokens*) en `app/globals.css`, así un tema cambia todo a la vez.

**¿Cómo funcionan los tres temas?**
El `<html>` lleva `data-tema="claro|oscuro|lampara"`. Un script corto en el `<head>` lee la cookie y lo pone antes de
pintar, para que no parpadee. Los tokens cambian según ese atributo.
*Dónde:* `lib/tema.ts` (`scriptTema`), `app/layout.tsx`, `app/globals.css`.

**¿Qué es shadcn/ui?**
No es una librería que se instala y ya: copia el código de los componentes al proyecto (`components/ui/`) y yo los
adapto. Por debajo usa Radix, que trae la accesibilidad (teclado, foco, roles ARIA) en menús y diálogos.

**¿Es responsive?**
Sí. En el celular las pestañas de la barra pasan a un menú lateral (`Sheet`) y las sub-navegaciones se desplazan en
horizontal. Probado en el celular.

**¿Y la accesibilidad?**
Contraste WCAG AA medido con un script (`pnpm diseno:contraste`) en los tres temas; navegación con teclado; respeta
"movimiento reducido" del sistema en las animaciones.

## 6. Datos y concurrencia (vistos desde la web)

**¿Por qué sin ORM?**
Para aprender el SQL que se ejecuta y controlarlo (bloqueos, `COUNT DISTINCT`, transacciones). El costo es escribir
más código.

**¿Qué pasa si dos bibliotecarios prestan el mismo ejemplar a la vez?**
El préstamo va dentro de `enTransaccion()` y bloquea las filas con `SELECT … FOR UPDATE`. El segundo espera; cuando
entra, ve el ejemplar ya prestado y recibe un error. Los bloqueos van siempre en el mismo orden (ejemplar → reservas
→ lector) para evitar *deadlocks*. Lo probé con dos préstamos simultáneos.
*Dónde:* `lib/db.ts` → `enTransaccion`, `lib/actions/circulacion.ts` → `prestarEjemplar`.

**¿Por qué un solo pool de conexiones?**
Abrir una conexión por petición es caro. En desarrollo Next recarga módulos al guardar, así que el pool se guarda en
`globalThis` para no crear uno nuevo cada vez.

**¿Los límites (días de préstamo, máximo de libros) están en el código?**
No: están en la BD (`tipo_lector`, `configuracion`). Cambiarlos no requiere tocar código.

## 7. Proceso y estado del proyecto

**¿Cómo organizaste el trabajo?**
Por fases: reglas y modelo de datos, scaffold, catálogo, panel, cuenta del lector, digital, rediseño, comunidad.
Cada paso: concepto → construcción → verificación → commit. Ramas por funcionalidad que se integran en `main`.

**¿Tienes pruebas automáticas?**
No todavía; es una de las mejoras pendientes. Las verificaciones fueron manuales y con scripts que envían formularios
sin navegador (más de 30 casos en la Fase 3 y 56 en la Fase 4), además de `pnpm lint`, `pnpm build` y el script de
contraste.

**¿Qué falta?**
Compras con pasarela real, administración de la red, traslados y auditorías, subir libros desde el panel, foro,
pruebas automáticas y despliegue. Ver `04-ficha-tecnica.md`, sección 10.

**¿Cuál fue el problema más difícil?**
Elige uno que puedas contar con detalle:
- **Concurrencia en préstamos**: dos personas pidiendo la última licencia digital a la vez; se resolvió con
  transacciones y `FOR UPDATE` en orden fijo.
- **JavaScript dentro de los EPUB**: el lector no lo bloqueaba; se resolvió con la CSP con nonce en `proxy.ts`.
- **RN-75**: probando en el otro equipo descubrí que un lector podía tener dos copias de la misma obra; se agregó la
  regla y la validación dentro de la transacción.

**¿Usaste IA?**
Respuesta honesta: sí, como tutor y apoyo para revisar, con reglas escritas (`CLAUDE.md`) para que explique cada paso.
Las decisiones de reglas y diseño son mías y están fechadas en `docs/`.

## 8. Preguntas difíciles: cómo responder sin inventar

| Si preguntan… | Responde |
|---|---|
| Algo que no implementaste ("¿y el carrito?") | "Está modelado en la BD pero no construido; es la fase 6." |
| Un número que no recuerdas | "Está en la ficha técnica", y ábrela |
| "¿Es seguro al 100 %?" | "No existe eso. Cubrí lo principal de OWASP (inyección, sesión, XSS, CSRF, permisos) y anoté los límites, como la captura de pantalla del libro." |
| "¿Escala?" | "Hoy es un monolito con una BD; el pool de conexiones y las consultas con índices ayudan. Para más carga: caché y réplicas de lectura, pero no lo he medido." |
| Algo de Next que no sabes | "No lo usé en este proyecto; lo que sí hice fue…" y lleva la respuesta a lo que conoces |
