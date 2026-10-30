// URL que no coincide con ninguna ruta (/xyz): Next usa el not-found de la raíz, que se dibuja dentro del layout
// raíz y por eso sin la barra superior. Es la misma página que la del sitio (app/(sitio)/not-found.tsx), que atiende
// los notFound() de sus páginas (un ISBN inexistente) y sí queda dentro de la barra.
export { default } from "./(sitio)/not-found";
