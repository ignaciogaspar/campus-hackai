/* Cargar el planning, solo secretaría: subir o pegar la planilla de clases,
   cargar una clase a mano (un cambio de último momento, una clase extra o una
   suspendida) y ver y borrar lo cargado. Sin reglas de negocio: qué se entiende
   de cada fila y quién puede cargar lo decide Planning. */
import { Trash2 } from 'lucide-react'
import type { Metadata } from 'next'
import { addPlanningClass, removePlanningClass } from '@/app/actions/planning'
import { timeOf, whenLabel } from '@/components/planning/format'
import { PlanningUpload } from '@/components/planning/planning-upload'
import { PageHeader } from '@/components/shell/page-header'
import { ActionForm, SubmitButton } from '@/components/spaces/action-form'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List, ListItem } from '@/components/ui/list'
import { Select } from '@/components/ui/select'
import { ErrorNotice } from '@/components/ui/states'
import { StatusPill } from '@/components/ui/status-pill'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PlanningEntry } from '@/lib/core/planning'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Cargar clases · Campus HackAI' }

const LABEL = 'flex min-w-0 flex-col gap-1 text-[0.8125rem] font-semibold'
const INPUT =
  'min-h-11 w-full rounded-[10px] border border-border bg-card px-3 text-[0.9375rem] font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
const HELP = 'font-normal text-muted-foreground'

const DAYS = [
  { value: '', label: 'Solo la fecha' },
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' }
]

const STATES = [
  { value: '', label: 'Se dicta' },
  { value: 'suspendida', label: 'Suspendida' }
]

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<'input'>) {
  return (
    <label className={LABEL}>
      {label}
      <input name={name} className={INPUT} autoComplete='off' {...props} />
    </label>
  )
}

/* Una clase a mano. Con «Día» se repite cada semana; con «Fecha», es de ese día y pisa la semanal de la misma
   materia y comisión: así se carga el cambio de aula de mañana. */
function ManualEntry() {
  return (
    <Card className='p-4'>
      <p className='text-xs font-semibold text-muted-foreground'>A mano</p>
      <h2 className='text-lg font-extrabold'>Cargar una clase</h2>
      <p className={cn('pt-1 text-[0.8125rem]', HELP)}>
        Para un cambio de último momento, poné la fecha y el aula nueva de esa materia y comisión: ese día reemplaza a
        la clase de siempre.
      </p>
      <ActionForm action={addPlanningClass} resetOnSuccess className='mt-3 flex flex-col gap-3'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <Field label='Materia' name='materia' required maxLength={120} placeholder='Análisis Matemático I' />
          <Field label='Comisión' name='comision' maxLength={120} placeholder='A' />
          <Field label='Facultad' name='facultad' maxLength={120} placeholder='FI' />
          <Field label='Edificio' name='edificio' maxLength={120} placeholder='Pilar - Edificio Olivo' />
          <Field label='Aula' name='aula' required maxLength={120} placeholder='Aula A9' />
          <label className={LABEL}>
            Día
            <Select name='dia' aria-label='Día' defaultValue='' options={DAYS} className={INPUT} />
          </label>
          <Field label='Fecha' name='fecha' type='date' />
          <label className={LABEL}>
            Estado
            <Select name='estado' aria-label='Estado' defaultValue='' options={STATES} className={INPUT} />
          </label>
          <Field label='Inicio' name='inicio' type='time' required />
          <Field label='Fin' name='fin' type='time' required />
        </div>
        <SubmitButton className={cn(buttonVariants(), 'self-start rounded-[10px] px-4 text-[0.9375rem] font-bold')}>
          Cargar la clase
        </SubmitButton>
      </ActionForm>
    </Card>
  )
}

function EntryRow({ entry }: { entry: PlanningEntry }) {
  return (
    <ListItem
      title={
        <span className='break-words'>
          {entry.section ? `${entry.subject} · Comisión ${entry.section}` : entry.subject}
        </span>
      }
      meta={
        <>
          <span>
            {whenLabel(entry)}, {timeOf(entry.start)} a {timeOf(entry.end)}
          </span>
          <span>· {[entry.room, entry.building, entry.school].filter(Boolean).join(' · ')}</span>
        </>
      }
      end={
        <span className='flex items-center gap-2'>
          {entry.cancelled && <StatusPill tone='warning'>Suspendida</StatusPill>}
          {entry.date && !entry.cancelled && <StatusPill tone='info'>Ese día</StatusPill>}
          <ActionForm action={removePlanningClass} className='contents'>
            <input type='hidden' name='id' value={entry.id} />
            <SubmitButton
              aria-label={`Borrar ${entry.subject} del planning`}
              title='Borrar'
              className='grid size-11 cursor-pointer place-items-center rounded-lg text-destructive hover:bg-destructive/10 focus-ring'
            >
              <Trash2 aria-hidden='true' className='size-4' strokeWidth={2} />
            </SubmitButton>
          </ActionForm>
        </span>
      }
    />
  )
}

export default async function CargarPlanningPage({ searchParams }: { searchParams: Promise<{ guardadas?: string }> }) {
  await requireSession('secretaria')
  const [{ guardadas }, entries] = await Promise.all([searchParams, system().planning.entries()])
  const saved = guardadas && /^\d+$/.test(guardadas) ? Number(guardadas) : null

  return (
    <>
      <PageHeader
        title='Cargar clases'
        subtitle='Las aulas y los horarios del Planning.'
        art='hoy'
        backHref='/planning'
      />
      <main className='flex w-full flex-col gap-4 px-4 pt-5 pb-16 lg:px-8 lg:pt-8'>
        {saved !== null && (
          <p role='status' className='rounded-xl bg-success/10 px-4 py-3 text-[0.875rem] font-semibold text-success'>
            Listo, guardamos {saved === 1 ? '1 clase' : `${saved} clases`}. Ya se ven en el Planning.
          </p>
        )}
        <PlanningUpload />
        <ManualEntry />
        <section aria-labelledby='cargadas' className='flex flex-col gap-3'>
          <h2 id='cargadas' className='text-lg font-extrabold'>
            Lo cargado{entries.ok ? ` (${entries.value.length})` : ''}
          </h2>
          {!entries.ok ? (
            <ErrorNotice>
              No pudimos traer lo cargado porque la base no responde. Probá de nuevo en un rato.
            </ErrorNotice>
          ) : entries.value.length === 0 ? (
            <p className='text-[0.875rem] text-muted-foreground'>Todavía no hay clases cargadas.</p>
          ) : (
            <List>
              {entries.value.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </List>
          )}
        </section>
      </main>
    </>
  )
}
