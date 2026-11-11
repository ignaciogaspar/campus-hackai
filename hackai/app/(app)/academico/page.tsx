/* Académico: las notas de parciales juntas, vengan de la historia académica o
   de actuación provisoria; la historia con las materias aprobadas y el
   promedio; y las constancias con el enlace directo a la Autogestión del SIU.
   Sin reglas de negocio: qué nota va primero, qué materia está aprobada y si
   cumple una constancia lo decide Cursada.

   En el celular es una columna: notas, constancias e historia, en el orden de
   lo que más se busca. En compu, notas e historia a la izquierda y las
   constancias a la derecha. Cada bloque muestra su propio error. */
import { GraduationCap } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AcademicHistory } from '@/components/academic/academic-history'
import { CertificateCard, certificateTitle } from '@/components/academic/certificate-card'
import { GradeList } from '@/components/academic/grade-list'
import { activeProgram } from '@/components/session/person-text'
import { ProfileMenu } from '@/components/session/profile-menu'
import { SignOutButton } from '@/components/session/sign-out-button'
import { PageHeader } from '@/components/shell/page-header'
import { EmptyState, ErrorNotice, StaleNotice } from '@/components/ui/states'
import { requireSession } from '@/lib/auth'
import { system } from '@/lib/composition'
import type { PeopleError } from '@/lib/core/people'
import type { AcademicRecord, CertificateStatus, CertificateType, Fresh, StudiesReadError } from '@/lib/core/studies'
import type { Result } from '@/lib/result'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Académico · Campus HackAI' }

const PERSON_ERRORS: Record<PeopleError, string> = {
  'falla-externa': 'No pudimos traer tus datos porque el SIU no responde. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus datos en el SIU. Salí y volvé a entrar.'
}

const RECORD_ERRORS: Partial<Record<StudiesReadError, string>> = {
  'falla-externa': 'No pudimos traer tus notas del SIU. Probá de nuevo en un rato.',
  'persona-desconocida': 'No encontramos tus notas en el SIU. Si recién te inscribiste, puede tardar unos días.'
}

const CERTIFICATES: CertificateType[] = ['alumno-regular', 'examen-final']

function readTime(readAt: string): string {
  return new Date(readAt).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function Block({
  id,
  title,
  hint,
  className,
  children
}: {
  id: string
  title: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)}>
      <div className='flex flex-col gap-0.5 px-1'>
        <h2 id={id} className='text-lg font-extrabold'>
          {title}
        </h2>
        {hint && <p className='text-[0.8125rem] text-pretty text-muted-foreground'>{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** Lo del alumno: notas, constancias e historia, cada bloque con su error. */
function StudentAcademic({
  record,
  certificates
}: {
  record: Result<Fresh<AcademicRecord>, StudiesReadError>
  certificates: Result<CertificateStatus, StudiesReadError>[]
}) {
  const recordError = record.ok ? null : (RECORD_ERRORS[record.error] ?? 'Algo salió mal al traer tus notas.')
  return (
    <>
      {record.ok && record.value.stale && (
        <StaleNotice>
          El SIU no responde. Te mostramos tus notas como estaban el {readTime(record.value.readAt)}: puede que falte
          alguna.
        </StaleNotice>
      )}
      <div className='grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10'>
        <Block
          id='notas'
          title='Notas de parciales'
          hint='Todas juntas, estén en la historia académica o en un acta abierta.'
          className='lg:col-start-1'
        >
          {record.ok ? <GradeList grades={record.value.data.grades} /> : <ErrorNotice>{recordError}</ErrorNotice>}
        </Block>

        <Block
          id='constancias'
          title='Constancias'
          hint='Se piden en la Autogestión del SIU: te la abrimos en otra pestaña.'
          className='lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1'
        >
          {certificates.map((result, i) =>
            result.ok ? (
              <CertificateCard key={CERTIFICATES[i]} status={result.value} />
            ) : (
              <ErrorNotice key={CERTIFICATES[i]}>
                No pudimos saber si podés pedir la {certificateTitle(CERTIFICATES[i]).toLowerCase()}. Probá de nuevo en
                un rato.
              </ErrorNotice>
            )
          )}
        </Block>

        <Block id='historia' title='Historia académica' className='lg:col-start-1'>
          {record.ok ? <AcademicHistory record={record.value.data} /> : <ErrorNotice>{recordError}</ErrorNotice>}
        </Block>
      </div>
    </>
  )
}

export default async function AcademicoPage() {
  const session = await requireSession()
  const studies = system().studies
  const [found, record, ...certificates] = await Promise.all([
    system().people.get(session.personId),
    studies.record(session.personId),
    ...CERTIFICATES.map((type) => studies.certificate(session.personId, type))
  ])
  const person = found.ok ? found.value : null
  const program = person ? activeProgram(person) : undefined

  return (
    <>
      <PageHeader
        title='Académico'
        kicker={program?.name}
        school={person?.school.name}
        actions={
          person ? (
            <>
              <SignOutButton className='hidden lg:block' />
              <ProfileMenu person={person} detail={program?.name ?? person.school.name} />
            </>
          ) : (
            <SignOutButton />
          )
        }
      />

      <main className='flex w-full flex-col gap-6 px-4 pt-5 pb-16 lg:px-6 lg:pt-8'>
        {!found.ok ? (
          <ErrorNotice>{PERSON_ERRORS[found.error]}</ErrorNotice>
        ) : found.value.role === 'profesor' ? (
          <EmptyState icon={GraduationCap} title='Académico es la vida académica del alumno'>
            Acá cada alumno ve sus notas, su historia académica y sus constancias. Tus comisiones están en Materias.
          </EmptyState>
        ) : (
          <StudentAcademic record={record} certificates={certificates} />
        )}
      </main>
    </>
  )
}
