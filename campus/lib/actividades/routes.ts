// Rutas de la feature (actividades, office hours, radar). Para sumar al nav en lib/routes.ts.
export const actividadesRoutes = {
  campusActividades: '/campus/actividades',
  campusActividad: (id: string) => `/campus/actividades/${id}`,
  profesorActividades: '/profesor/actividades',
  profesorActividad: (id: string) => `/profesor/actividades/${id}`,
  campusOfficeHours: '/campus/office-hours',
  profesorOfficeHours: '/profesor/office-hours',
  campusRadar: '/campus/radar',
  profesorRadar: '/profesor/actividades/radar',
  eco: '/api/actividades/eco',
  api: (id: string) => `/api/actividades/${id}`,
} as const
