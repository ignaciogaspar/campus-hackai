import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryClassroom } from '@/lib/adapters/memoria/classroom'
import { createMemoryCourseworkStore } from '@/lib/adapters/memoria/coursework-store'
import { createMemoryExternalChannel } from '@/lib/adapters/memoria/external-channel'
import { createMemoryFiles } from '@/lib/adapters/memoria/files'
import { createMemoryIdentity } from '@/lib/adapters/memoria/identity'
import { createMemoryPeopleStore } from '@/lib/adapters/memoria/people-store'
import { createMemoryPlanningStore } from '@/lib/adapters/memoria/planning-store'
import { createMemorySiu } from '@/lib/adapters/memoria/siu'
import { createMemorySpacesStore } from '@/lib/adapters/memoria/spaces-store'
import { createMemoryStudiesStore } from '@/lib/adapters/memoria/studies-store'
import { syntheticData } from '@/lib/adapters/synthetic-data'
import { createCoursework } from '@/lib/core/coursework'
import { createPeople } from '@/lib/core/people'
import { createPlanning, type PlanningEntryInput } from '@/lib/core/planning'
import { createSpaces } from '@/lib/core/spaces'
import { createStudies } from '@/lib/core/studies'
import { createToday } from '@/lib/core/today'
import { fallible, movableClock } from '@/tests/core/helpers'

/** Hoy con Personas, Cursada, Espacios, Seguimiento y Planning reales sobre los puertos en memoria. */
function build(planningEntries: PlanningEntryInput[] = syntheticData.planning) {
  const { clock, advance } = movableClock(syntheticData.now)
  const { port: siu, state: siuState } = fallible(createMemorySiu(syntheticData, clock))
  const classroom = createMemoryClassroom(syntheticData)
  const people = createPeople({
    identity: createMemoryIdentity(syntheticData),
    siu,
    store: createMemoryPeopleStore(syntheticData)
  })
  const studies = createStudies({ people, siu, classroom, clock, store: createMemoryStudiesStore() })
  const spaces = createSpaces({
    people,
    studies,
    externalChannel: createMemoryExternalChannel(syntheticData, clock),
    classroom,
    files: createMemoryFiles(),
    clock,
    store: createMemorySpacesStore(),
    timer: () => 0
  })
  const coursework = createCoursework({
    studies,
    files: createMemoryFiles(),
    clock,
    store: createMemoryCourseworkStore()
  })
  const planning = createPlanning({ people, store: createMemoryPlanningStore(planningEntries) })
  return { today: createToday({ studies, spaces, coursework, clock, planning }), siuState, advance }
}

const summary = (classes: { subject: string; section: string | null; day: string; room: string; change: unknown }[]) =>
  classes.map((c) => [c.day, c.subject, c.section, c.room, c.change])

test('classChanges avisa al alumno los cambios de aula y las suspensiones de sus comisiones de los próximos días', async () => {
  const { today } = build([
    ...syntheticData.planning,
    // Una suspensión de la comisión B de AM1, que Tomás no cursa: no se le avisa.
    {
      subject: 'Análisis Matemático I',
      section: 'B',
      school: 'FI',
      campus: 'Pilar',
      building: 'Edificio Olivo',
      wing: 'Módulo A',
      room: 'Aula 14',
      weekday: null,
      date: '2026-11-12',
      start: 14 * 60,
      end: 16 * 60,
      cancelled: true
    }
  ])
  const changes = await today.classChanges('p-taguirre')
  assert.ok(changes.ok)
  assert.deepEqual(summary(changes.value), [['2026-11-11', 'Análisis Matemático I', 'A', 'Aula A10', 'cambio']])
})

test('classChanges no avisa lo que ya pasó ni lo que está a más de una semana', async () => {
  const { today, advance } = build()
  const DAY = 24 * 60
  advance(-7 * DAY)
  assert.deepEqual(
    await today.classChanges('p-taguirre'),
    { ok: true, value: [] },
    'el martes 3 el cambio del 11 está a más de una semana'
  )
  advance(6 * DAY)
  const dayBefore = await today.classChanges('p-taguirre')
  assert.ok(dayBefore.ok && dayBefore.value.length === 1, 'el lunes 9 ya se avisa')
  advance(3 * DAY)
  assert.deepEqual(await today.classChanges('p-taguirre'), { ok: true, value: [] }, 'el jueves 12 ya pasó')
})

test('classChanges sin Planning, o con el SIU caído, vuelve vacío; a una persona que no existe, el error', async () => {
  const { today, siuState } = build()
  siuState.down = true
  assert.deepEqual(await today.classChanges('p-taguirre'), { ok: true, value: [] })
  siuState.down = false
  assert.deepEqual(await today.classChanges('p-fantasma'), { ok: false, error: 'persona-desconocida' })
})
