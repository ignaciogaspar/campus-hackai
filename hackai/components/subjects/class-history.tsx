/* El historial de clases de la comisión para el docente, en «Alumnos y clases»:
   cada clase tomada con su fecha, la modalidad, quiénes faltaron y cómo quedó
   el pase al SIU. La de hoy se puede abrir para corregirla. En el celular es una
   columna de filas; los ausentes se despliegan sin salir de la pantalla. */
import { History } from 'lucide-react'
import Link from 'next/link'
import { longDay, timeOf } from '@/components/dates'
import { absentCount, attendanceHref, PASE_TEXT, PASE_TONE } from '@/components/subjects/attendance-format'
import { Card } from '@/components/ui/card'
import { List } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import type { ClassHistoryEntry } from '@/lib/core/studies'

const MODALITY_TEXT: Record<NonNullable<ClassHistoryEntry['modality']>, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrida: 'Híbrida'
}

function HistoryRow({
  entry,
  subjectId,
  sectionId
}: {
  entry: ClassHistoryEntry
  subjectId: string
  sectionId: string
}) {
  return (
    <li className='flex flex-col gap-1.5 px-4 py-3.5'>
      <span className='font-semibold'>{`${longDay(entry.classAt)} · ${timeOf(entry.classAt)}`}</span>
      <span className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
        {entry.modality && <span>{MODALITY_TEXT[entry.modality]}</span>}
        <StatusPill tone={PASE_TONE[entry.pase]}>{PASE_TEXT[entry.pase]}</StatusPill>
      </span>
      {entry.absent.length === 0 ? (
        <span className='text-[0.8125rem] text-muted-foreground'>{absentCount(0, entry.total)}</span>
      ) : (
        <details className='text-[0.8125rem] text-muted-foreground'>
          <summary className='flex min-h-11 cursor-pointer items-center font-semibold text-foreground focus-ring'>
            {absentCount(entry.absent.length, entry.total)}
          </summary>
          <ul className='flex flex-col gap-1 pb-1 pl-4'>
            {entry.absent.map((a) => (
              <li key={a.legajo}>{a.name ? `${a.name} · Legajo ${a.legajo}` : `Legajo ${a.legajo}`}</li>
            ))}
          </ul>
        </details>
      )}
      {entry.today && (
        <Link
          href={attendanceHref(subjectId, sectionId, entry.classAt)}
          className='inline-flex min-h-11 items-center self-start text-sm font-bold text-blue focus-ring'
        >
          Corregir la lista
        </Link>
      )}
    </li>
  )
}

export function ClassHistory({
  history,
  subjectId,
  sectionId,
  sectionName
}: {
  history: ClassHistoryEntry[]
  subjectId: string
  sectionId: string
  sectionName: string
}) {
  if (history.length === 0) {
    return (
      <EmptyState icon={History} title='Todavía no tomaste lista'>
        Cuando tomes lista en la comisión {sectionName}, la clase queda guardada acá.
      </EmptyState>
    )
  }
  return (
    <section aria-label={`Historial de la comisión ${sectionName}`} className='flex max-w-3xl flex-col gap-2'>
      <h2 className='px-1 text-sm font-bold text-muted-foreground'>Historial de clases</h2>
      <Card>
        <List>
          {history.map((entry) => (
            <HistoryRow key={entry.classAt} entry={entry} subjectId={subjectId} sectionId={sectionId} />
          ))}
        </List>
      </Card>
    </section>
  )
}
