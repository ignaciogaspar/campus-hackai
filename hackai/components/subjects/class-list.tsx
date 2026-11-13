/* La clase de hoy de la comisión para el docente, en «Alumnos y clases»: la
   entrada para tomar lista (o corregirla), con cómo quedó su pase al SIU. Las
   clases anteriores están en el historial (class-history.tsx), no acá. Si hoy
   no hay clase, una franja baja dice cuándo es la próxima (la calcula Cursada)
   y, si todavía no se tomó lista nunca, lo dice ahí mismo en vez de sumar otro
   vacío. */
import { ClipboardCheck } from 'lucide-react'
import { longDay, timeOf } from '@/components/dates'
import {
  absentCount,
  attendanceHref,
  nextClassText,
  PASS_TEXT,
  PASS_TONE
} from '@/components/subjects/attendance-format'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { ClassItem, NextClass } from '@/lib/core/studies'

function ClassRow({
  item,
  subjectId,
  sectionId,
  total
}: {
  item: ClassItem
  subjectId: string
  sectionId: string
  total: number
}) {
  const { taken } = item
  return (
    <ListItem
      href={attendanceHref(subjectId, sectionId, item.classAt)}
      title={`${longDay(item.classAt)} · ${timeOf(item.classAt)}`}
      description={taken ? absentCount(taken.absent.length, total) : 'Todavía no tomaste lista.'}
      meta={taken && <StatusPill tone={PASS_TONE[taken.pass]}>{PASS_TEXT[taken.pass]}</StatusPill>}
      end={<span className='self-center text-sm font-bold text-blue'>{taken ? 'Corregir' : 'Tomar lista'}</span>}
    />
  )
}

export function ClassList({
  classes,
  subjectId,
  sectionId,
  sectionName,
  total,
  next,
  noHistory
}: {
  classes: ClassItem[]
  subjectId: string
  sectionId: string
  sectionName: string
  /** Cuántos alumnos tiene la comisión, para decir «2 ausentes de 28». */
  total: number
  /** La próxima clase, para decir cuándo es si hoy no hay; `undefined` si no se pudo leer. */
  next: NextClass | null | undefined
  /** Si todavía no se tomó lista en la comisión: sin clase hoy, se dice en la misma franja. */
  noHistory: boolean
}) {
  const today = classes.filter((c) => c.today)
  if (today.length === 0) {
    const when =
      next === undefined
        ? `El día que la comisión ${sectionName} tenga clase, vas a poder tomar lista acá.`
        : nextClassText(next, sectionName)
    const notStarted = Boolean(next?.termStartsOn)
    return (
      <div className='max-w-3xl'>
        <EmptyState
          icon={ClipboardCheck}
          title={notStarted ? 'La cursada todavía no empezó' : 'Hoy no hay clase'}
          compact
        >
          {when}
          {noHistory && !notStarted && ' Todavía no tomaste lista en esta comisión.'}
        </EmptyState>
      </div>
    )
  }
  return (
    <section aria-label={`Clase de hoy de la comisión ${sectionName}`} className='flex max-w-3xl flex-col gap-2'>
      <h2 className='px-1 text-sm font-bold text-muted-foreground'>Clase de hoy</h2>
      <Card>
        <List>
          {today.map((item) => (
            <ClassRow key={item.classAt} item={item} subjectId={subjectId} sectionId={sectionId} total={total} />
          ))}
        </List>
      </Card>
    </section>
  )
}
