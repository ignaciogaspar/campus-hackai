import assert from 'node:assert/strict'
import { test } from 'node:test'
import { byScriptRoleAndSurname } from '@/components/session/person-order'
import type { Person } from '@/lib/core/people'

const person = (id: string, name: string, role: Person['role']): Person => ({
  id,
  name,
  role,
  school: { id: 'fi', name: 'Facultad de Ingeniería' },
  programs: []
})

test('en el ingreso, las personas del guion van primeras y después alumnos y docentes por apellido', () => {
  const people = [
    person('p-zalumna', 'Ana Zárate', 'alumno'),
    person('p-mledesma', 'Mariana Ledesma', 'profesor'),
    person('p-adocente', 'Bruno Acosta', 'profesor'),
    person('p-taguirre', 'Tomás Aguirre', 'alumno'),
    person('p-balumno', 'Carla Benítez', 'alumno')
  ]

  assert.deepEqual(
    people.sort(byScriptRoleAndSurname).map((p) => p.id),
    ['p-taguirre', 'p-mledesma', 'p-balumno', 'p-zalumna', 'p-adocente']
  )
})
