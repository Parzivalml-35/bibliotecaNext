import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next rechaza el cuerpo de una Server Action de más de 1 MB (por defecto) antes de llegar a nuestro código.
      // RN-82 permite fotos de avatar de hasta configuracion.max_kb_avatar (2048 KB en el seed): ESA es la regla y la
      // comprueba la acción. Esto es solo un techo técnico, fijo porque next.config no puede leer la BD (C-04).
      // 3 MB deja margen para lo que multipart/form-data agrega (límites y cabeceras de cada campo).
      // OJO: si se sube max_kb_avatar por encima de ~2900, hay que subir también este techo.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
