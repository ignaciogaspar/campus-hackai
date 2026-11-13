import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { xlsxFile } from '@/lib/xlsx'
import { readXlsx } from '@/lib/xlsx-read'

/* La planilla de prueba imita un .xlsx de Excel: comprimido con deflate, textos
   en sharedStrings, horas como fracción de día, una fecha como día de Excel, un
   texto en la celda (inlineStr) y la hoja con otro nombre de archivo. */
const fixture = readFileSync(new URL('./fixtures/planilla-clases.xlsx', import.meta.url))

test('readXlsx lee la primera hoja de un .xlsx comprimido, como los de Excel', () => {
  const rows = readXlsx(fixture)
  assert.ok(rows)
  assert.deepEqual(rows[0], [
    'Materia',
    'Comisión',
    'Facultad',
    'Edificio',
    'Aula',
    'Día',
    'Fecha',
    'Inicio',
    'Fin',
    'Estado'
  ])
  assert.deepEqual(rows[1], [
    'Análisis Matemático I',
    'A',
    'FI',
    'Pilar - Edificio Olivo',
    'Aula A9',
    'lunes',
    null,
    0.375,
    0.5416666666666666
  ])
  assert.deepEqual(rows[2], [], 'una fila que no está en la hoja queda vacía')
  assert.deepEqual(rows[3], ['Termodinámica', null, null, null, 'Aula A9', null, 46339, 9, '13:00', 'suspendida'])
  assert.deepEqual(rows[4], ['Física & Química'])
})

test('readXlsx lee lo que escribe lib/xlsx.ts, sin comprimir', () => {
  const file = xlsxFile([
    {
      name: 'Clases',
      rows: [
        ['Materia', 'Aula'],
        ['Física I', 12],
        [null, 'B2']
      ]
    }
  ])
  assert.deepEqual(readXlsx(file), [
    ['Materia', 'Aula'],
    ['Física I', 12],
    [null, 'B2']
  ])
})

test('readXlsx devuelve null si el archivo no es un .xlsx', () => {
  assert.equal(readXlsx(Buffer.from('Materia,Aula\nFísica I,12\n')), null)
  assert.equal(readXlsx(Buffer.alloc(0)), null)
})
