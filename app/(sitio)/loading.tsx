import { EsqueletoCatalogo } from "@/components/esqueletos";

// Next envuelve la página de esta carpeta (y las de adentro) en un <Suspense> con este fallback:
// se muestra al instante mientras el servidor consulta MySQL, y se reemplaza solo cuando llega el contenido.
export default function Cargando() {
  return <EsqueletoCatalogo />;
}
