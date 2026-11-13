/* Las tres vistas de Reportes en un riel: el tablero, el listado de alumnos y los
   que están en seguimiento. Al cambiar de vista viajan los filtros de perfil
   (año, facultad, carrera, sede, ingreso, créditos y avance). */
import { BookmarkCheck, ChartColumnBig, Users } from 'lucide-react'
import Link from 'next/link'
import { hrefOf, sharedFilters } from '@/components/reports/params'
import { railItem, railTrack } from '@/components/ui/rail'
import type { ReportFilters } from '@/lib/core/reports'
import { cn } from '@/lib/utils'

export type ReportTab = 'tablero' | 'alumnos' | 'seguimiento'

const TABS = [
  { tab: 'tablero', path: '/reportes', label: 'Tablero', icon: ChartColumnBig },
  { tab: 'alumnos', path: '/reportes/alumnos', label: 'Alumnos', icon: Users },
  { tab: 'seguimiento', path: '/reportes/seguimiento', label: 'En seguimiento', icon: BookmarkCheck }
] as const

export function ReportTabs({ active, filters }: { active: ReportTab; filters: ReportFilters | null }) {
  return (
    <nav aria-label='Vistas de Reportes' data-print='hide' className={cn(railTrack({ size: 'sm' }), 'w-full max-w-lg')}>
      {TABS.map(({ tab, path, label, icon: Icon }) => (
        <Link
          key={tab}
          href={filters ? hrefOf(path, sharedFilters(filters)) : path}
          aria-current={tab === active ? 'page' : undefined}
          className={railItem({ size: 'sm' })}
        >
          <Icon aria-hidden='true' className='size-4' />
          {label}
        </Link>
      ))}
    </nav>
  )
}
