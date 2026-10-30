import { EsqueletoLibro } from "@/components/esqueletos";

// Más específico que app/loading.tsx: al entrar a un libro se ve la forma de la ficha, no la del catálogo.
// En rutas dinámicas, además, permite que la navegación sea inmediata (la guía de Next lo recomienda).
export default function CargandoLibro() {
  return <EsqueletoLibro />;
}
