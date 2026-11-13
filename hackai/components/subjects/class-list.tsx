/* Las clases de la comisión para el docente, en «Alumnos y clases»: la más
   nueva primero, con la lista que ya se tomó y cómo quedó su pase al SIU. La
   de hoy ofrece tomar lista (o corregirla); las otras se abren para verlas. */
import { ClipboardCheck } from 'lucide-react'
import { longDay, timeOf } from '@/components/dates'
import { absentCount, attendanceHref, PASE_TEXT, PASE_TONE } from '@/components/subjects/attendance-format'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { ClassItem } from '@/lib/core/studies'

/** Cuántas clases se listan: las últimas. */
const SHOWN = 8

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
      description={
        taken ? absentCount(taken.absent.length, total) : item.today ? 'Todavía no tomaste lista.' : 'No se tomó lista.'
      }
      meta={
        <>
          {item.today && <StatusPill tone='info'>Hoy</StatusPill>}
          {taken && <StatusPill tone={PASE_TONE[taken.pase]}>{PASE_TEXT[taken.pase]}</StatusPill>}
        </>
      }
      end={
        item.today ? (
          <span className='self-center text-sm font-bold text-blue'>{taken ? 'Corregir' : 'Tomar lista'}</span>
        ) : undefined
      }
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
  if (classes.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} title='Todavía no hay clases'>
        Cuando empiece el período de la comisión {sectionName}, vas a poder tomar lista acá.
      </EmptyState>
    )
  }
  return (
    <section aria-label={`Clases de la comisión ${sectionName}`} className='flex max-w-3xl flex-col gap-2'>
      <h2 className='px-1 text-sm font-bold text-muted-foreground'>Clases</h2>
      <Card>
        <List>
          {classes.slice(0, SHOWN).map((item) => (
            <ClassRow key={item.classAt} item={item} subjectId={subjectId} sectionId={sectionId} total={total} />
          ))}
        </List>
      </Card>
    </section>
  )
}
