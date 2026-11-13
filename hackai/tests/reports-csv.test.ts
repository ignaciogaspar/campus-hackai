/* Los CSV de Reportes se abren bien en Excel en español: BOM de UTF-8, punto y coma, coma decimal y fin de línea de
   Windows, con comillas donde hacen falta y sin fórmulas. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { StudentRow } from '@/lib/core/reports'
import { rowsFromText } from '@/lib/delimited-text'
import { csvCell, csvText, STUDENTS_HEADER, studentsCsv } from '@/lib/reports-csv'

test('una celda: número con coma decimal, texto con comillas si hace falta y sin fórmulas', () => {
  assert.equal(csvCell(7.25), '7,25')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell('Aguilar, Thiago'), 'Aguilar, Thiago')
  assert.equal(csvCell('Pidió "beca"; urgente'), '"Pidió ""beca""; urgente"')
  assert.equal(csvCell('=SUMA(A1)'), "'=SUMA(A1)")
  assert.equal(csvCell('-3'), "'-3")
})

test('el archivo lleva BOM, punto y coma y fin de línea de Windows', () => {
  const text = csvText([
    ['Legajo', 'Promedio'],
    ['240001', 7.5]
  ])
  assert.ok(text.startsWith('﻿'))
  assert.equal(text, '﻿Legajo;Promedio\r\n240001;7,5\r\n')
})

const row: StudentRow = {
  id: '240001',
  name: 'Aguilar, Thiago',
  email: 'thiago.aguilar001@alumnos.example.edu.ar',
  school: 'FI',
  programId: 'iinf',
  program: 'Ingeniería en Informática',
  campus: 'Pilar',
  cohort: 2024,
  status: 'baja',
  statusDate: '2026-03-10',
  entrant: false,
  progress: 40,
  credits: 3,
  creditsRequired: 8,
  failures: 3,
  average: 7.25,
  missing: 3,
  risks: ['atrasado', 'aplazos'],
  followUp: {
    studentId: '240001',
    note: 'Pidió beca; ver horarios',
    by: 'p-secretaria-fi',
    at: '2026-11-10T15:00:00.000Z'
  }
}

test('el listado sale con una fila por alumno que se vuelve a leer igual', () => {
  const rows = rowsFromText(studentsCsv([row]).replace('﻿', ''))
  assert.deepEqual(rows[0], STUDENTS_HEADER)
  assert.deepEqual(rows[1], [
    '240001',
    'Aguilar, Thiago',
    'thiago.aguilar001@alumnos.example.edu.ar',
    'FI',
    'Ingeniería en Informática',
    'Pilar',
    '2024',
    'Baja',
    '10/03/2026',
    '40',
    '3',
    '3',
    '8',
    '3',
    '7,25',
    'Atrasado, Muchos aplazos',
    'Pidió beca; ver horarios'
  ])
})
