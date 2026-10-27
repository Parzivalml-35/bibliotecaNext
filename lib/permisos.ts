import type { RolEmpleado } from "@/lib/definitions";

// docs/diseno.md, DI-10 y DI-11: ÚNICA fuente de los permisos del panel. La leen exigirEmpleado() (para verificar,
// RN-35), las Server Actions y el menú del panel (para mostrar solo lo que el rol usa). Ninguna lista de roles se
// escribe fuera de este archivo: así el menú y la verificación no se pueden desincronizar (UX-01, UX-02).
// No lleva "server-only": no hay secretos y el menú también lo usa.

// `satisfies` comprueba que cada lista tenga solo roles válidos, sin perder los nombres exactos de las claves.
export const PERMISOS = {
  // RN-33: préstamos, devoluciones, validar lectores y cobrar multas. El administrador de red no tiene sede
  // (RN-34) y no opera en mostrador.
  mostrador: ["bibliotecario", "coordinador"],
  // RN-33 (ubicar ejemplares), RN-20 y RN-49: trabajo sobre los ejemplares de la sede.
  coleccion: ["bibliotecario", "coordinador"],
  // Buscar un lector y ver su situación: cualquier empleado. Lo que se hace después tiene su propio permiso.
  lectores: ["bibliotecario", "coordinador", "admin_red"],
  // RN-67: anular una multa (el coordinador, solo las de su sede: eso lo comprueba la acción).
  anularMultas: ["coordinador", "admin_red"],
  // RN-33: reportes del coordinador (su sede) y del administrador de red (toda la red).
  reportes: ["coordinador", "admin_red"],
  // RN-33: administración de la red (catálogo, licencias, tipos de lector, configuración, empleados).
  red: ["admin_red"],
} as const satisfies Record<string, readonly RolEmpleado[]>;

export type Permiso = keyof typeof PERMISOS;

export function tienePermiso(rol: RolEmpleado, permiso: Permiso): boolean {
  // El `as` solo ensancha el tipo: includes() de una tupla `as const` no acepta un RolEmpleado cualquiera.
  return (PERMISOS[permiso] as readonly RolEmpleado[]).includes(rol);
}

export type PaginaPanel = { titulo: string; ruta: string; permiso: Permiso };
export type SeccionPanel = { titulo: string; paginas: PaginaPanel[] };

// Secciones de DI-10 con las rutas de HOY. R3b las mueve a /panel/mostrador, /panel/coleccion, etc.
export const SECCIONES_PANEL: SeccionPanel[] = [
  {
    titulo: "Mostrador",
    paginas: [
      { titulo: "Préstamos abiertos", ruta: "/panel", permiso: "mostrador" },
      { titulo: "Nuevo préstamo", ruta: "/panel/prestamos", permiso: "mostrador" },
      { titulo: "Devolución", ruta: "/panel/devoluciones", permiso: "mostrador" },
    ],
  },
  { titulo: "Lectores", paginas: [{ titulo: "Lectores y multas", ruta: "/panel/lectores", permiso: "lectores" }] },
  {
    titulo: "Colección",
    paginas: [
      { titulo: "Ubicar", ruta: "/panel/ubicar", permiso: "coleccion" },
      { titulo: "Perdidos", ruta: "/panel/perdidos", permiso: "coleccion" },
    ],
  },
  { titulo: "Reportes", paginas: [{ titulo: "Tablero", ruta: "/panel/tablero", permiso: "reportes" }] },
  { titulo: "Red", paginas: [{ titulo: "Licencias digitales", ruta: "/panel/licencias", permiso: "red" }] },
];

// Las secciones con solo las páginas que el rol puede abrir; una sección sin páginas no aparece.
export function seccionesDe(rol: RolEmpleado): SeccionPanel[] {
  return SECCIONES_PANEL.map((s) => ({ ...s, paginas: s.paginas.filter((p) => tienePermiso(rol, p.permiso)) }))
    .filter((s) => s.paginas.length > 0);
}

// Dónde empieza cada rol (DI-10, UX-07): el mostrador para quien atiende, los reportes para el administrador.
// Cada inicio tiene que ser una página que el rol puede abrir: si no, exigirEmpleado() redirigiría en bucle.
const INICIO: Record<RolEmpleado, string> = {
  bibliotecario: "/panel",
  coordinador: "/panel",
  admin_red: "/panel/tablero",
};

export function inicioDe(rol: RolEmpleado): string {
  return INICIO[rol];
}
