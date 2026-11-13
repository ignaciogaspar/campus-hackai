import type { Role } from '@/lib/core/people'

/** Lo que cambia para el docente: no rinde finales, integra la mesa, y las entregas son las que él carga.
    Acá y no en page.tsx porque el subtítulo también lo muestra loading.tsx, con el mismo texto. */
export const TEXTS: Record<Role, { subtitle: string; below: string }> = {
  alumno: {
    subtitle: 'Tus clases, parciales, finales y entregas en un solo lugar.',
    below: 'Las entregas vienen de Moodle y de HackAI: solo aparecen las que el docente cargó con fecha.'
  },
  profesor: {
    subtitle: 'Tus clases, parciales, mesas de final y entregas en un solo lugar.',
    below: 'Las entregas vienen de Moodle y de HackAI: aparecen las tareas que cargaste con fecha.'
  }
}
