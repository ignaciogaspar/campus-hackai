import assert from 'node:assert/strict'
import { test } from 'node:test'
import { byScriptRoleAndSurname } from '@/components/session/person-order'
import { signInUrl } from '@/components/session/sign-in-url'
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

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null })

test('el QR lleva la dirección que pidió el navegador, la del proxy si la hay', () => {
  assert.equal(signInUrl(headers({ host: 'localhost:3000' })), 'http://localhost:3000/')
  assert.equal(
    signInUrl(
      headers({
        host: 'interno:3000',
        'x-forwarded-host': 'hackai.vercel.app, otro',
        'x-forwarded-proto': 'https,http'
      })
    ),
    'https://hackai.vercel.app/'
  )
  assert.equal(signInUrl(headers({ host: 'hackai.test', 'x-forwarded-proto': 'javascript' })), 'http://hackai.test/')
  assert.equal(signInUrl(headers({})), null)
})
