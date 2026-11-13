/* La clase de hoy de la comisión para el docente, en «Alumnos y clases»: la
   entrada para tomar lista (o corregirla), con cómo quedó su pase al SIU. Las
   clases anteriores están en el historial (class-history.tsx), no acá. */
import { ClipboardCheck } from 'lucide-react'
import { longDay, timeOf } from '@/components/dates'
import { absentCount, attendanceHref, PASS_TEXT, PASS_TONE } from '@/components/subjects/attendance-format'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { ClassItem } from '@/lib/core/studies'

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
  total
}: {
  classes: ClassItem[]
  subjectId: string
  sectionId: string
  sectionName: string
  /** Cuántos alumnos tiene la comisión, para decir «2 ausentes de 28». */
  total: number
}) {
  const today = classes.filter((c) => c.today)
  if (today.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} title='Hoy no hay clase'>
        El día que la comisión {sectionName} tenga clase, vas a poder tomar lista acá.
      </EmptyState>
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
