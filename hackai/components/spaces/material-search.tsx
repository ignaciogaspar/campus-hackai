/* Buscar en el material: un formulario GET que deja lo buscado en `?buscar=`,
   así funciona sin JavaScript, con Enter y con el botón de buscar del teclado
   del celular. Los resultados son los archivos que coinciden, cada uno con su
   origen, y las consultas ya hechas en la comisión, las resueltas primero.
   Qué coincide y quién ve qué lo decide `search` de Espacios. */
import { Check, Search, SearchX, X } from 'lucide-react'
import Form from 'next/form'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { shortDate, spaceHref } from '@/components/spaces/format'
import { MaterialRow } from '@/components/spaces/material-panel'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorNotice } from '@/components/ui/states'
import type { QuestionMatch, SpaceSearch } from '@/lib/core/spaces'
import { cn } from '@/lib/utils'

/** Lo que devolvió la búsqueda: lo encontrado, o que no se pudo buscar. */
export type MaterialSearchResult = { ok: true; value: SpaceSearch } | { ok: false; query: string }

export function MaterialSearchForm({
  subjectId,
  channelId,
  query
}: {
  subjectId: string
  channelId: string
  query: string
}) {
  return (
    <Form action={spaceHref(subjectId)} role='search' aria-label='En el material' className='flex gap-2'>
      <input type='hidden' name='canal' value={channelId} />
      <label className='relative min-w-0 flex-1'>
        <span className='sr-only'>Buscar en el material</span>
        <Search
          aria-hidden='true'
          className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
        />
        <input
          type='search'
          name='buscar'
          defaultValue={query}
          // Al volver con otra búsqueda, el campo muestra la nueva.
          key={query}
          enterKeyHint='search'
          autoComplete='off'
          placeholder='Unidad 2, guía, parcial…'
          className='min-h-11 w-full rounded-[10px] border border-border bg-card pr-3 pl-9 text-[0.9375rem] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring'
        />
      </label>
      <button type='submit' className={cn(buttonVariants(), 'min-h-11 rounded-[10px] px-4 font-bold')}>
        Buscar
      </button>
    </Form>
  )
}

function ClearLink({ subjectId, channelId }: { subjectId: string; channelId: string }) {
  return (
    <Link
      href={spaceHref(subjectId, { canal: channelId })}
      className='inline-flex min-h-11 items-center gap-1 font-bold text-blue underline'
    >
      <X aria-hidden='true' className='size-4' />
      Limpiar búsqueda
    </Link>
  )
}

function QuestionBadge({ resolved }: { resolved: boolean }) {
  if (resolved) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-success-background px-2 py-0.5 text-[0.6875rem] font-bold text-success'>
        <Check aria-hidden='true' className='size-3.5' strokeWidth={2.4} />
        Resuelta
      </span>
    )
  }
  return (
    <span className='rounded-full bg-warning-background px-2 py-0.5 text-[0.6875rem] font-bold text-warning-foreground'>
      Sin resolver
    </span>
  )
}

function QuestionRow({ subjectId, question }: { subjectId: string; question: QuestionMatch }) {
  const replies = question.replies === 1 ? '1 respuesta' : `${question.replies} respuestas`
  return (
    <li>
      <Link
        href={spaceHref(subjectId, { canal: question.channelId, hilo: question.messageId })}
        className='flex flex-col gap-1 px-4 py-3 text-foreground hover:bg-blue/[0.04] focus-ring-inset'
      >
        <span className='line-clamp-2 font-semibold'>{question.text}</span>
        <span className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
          <QuestionBadge resolved={question.resolved} />
          <span>
            {[question.sectionName && `#consultas (${question.sectionName})`, question.author.name, replies]
              .filter(Boolean)
              .join(' · ')}{' '}
            · <time dateTime={question.createdAt}>{shortDate(question.createdAt)}</time>
          </span>
        </span>
      </Link>
    </li>
  )
}

function ResultGroup({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className='overflow-hidden rounded-[22px] bg-card shadow-card'>
      <h3 id={id} className='px-4 py-3 font-bold'>
        {title}
      </h3>
      <ul className='divide-y divide-border border-t border-border'>{children}</ul>
    </section>
  )
}

function count(n: number, one: string, many: string) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

export function MaterialSearchResults({
  subjectId,
  channelId,
  result
}: {
  subjectId: string
  channelId: string
  result: MaterialSearchResult
}) {
  if (!result.ok) {
    return (
      <ErrorNotice>
        <p>No pudimos buscar «{result.query}». Probá de nuevo en un rato.</p>
        <ClearLink subjectId={subjectId} channelId={channelId} />
      </ErrorNotice>
    )
  }
  const { query, material, questions } = result.value
  if (material.length === 0 && questions.length === 0) {
    return (
      <div className='flex flex-col items-center gap-1'>
        <EmptyState icon={SearchX} title={`No encontramos nada para «${query}»`}>
          Probá con otra palabra, el nombre de la unidad o parte del nombre del archivo.
        </EmptyState>
        <ClearLink subjectId={subjectId} channelId={channelId} />
      </div>
    )
  }
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-x-3 px-1'>
        <p role='status' className='text-[0.8125rem] text-muted-foreground'>
          {[
            material.length > 0 && count(material.length, 'archivo', 'archivos'),
            questions.length > 0 && count(questions.length, 'consulta', 'consultas')
          ]
            .filter(Boolean)
            .join(' y ')}{' '}
          para «{query}»
        </p>
        <ClearLink subjectId={subjectId} channelId={channelId} />
      </div>
      {material.length > 0 && (
        <ResultGroup id='resultados-material' title='Material'>
          {material.map((item) => (
            <MaterialRow key={item.id} item={item} showSection />
          ))}
        </ResultGroup>
      )}
      {questions.length > 0 && (
        <ResultGroup id='resultados-consultas' title='Consultas ya hechas'>
          {questions.map((q) => (
            <QuestionRow key={q.messageId} subjectId={subjectId} question={q} />
          ))}
        </ResultGroup>
      )}
    </div>
  )
}
