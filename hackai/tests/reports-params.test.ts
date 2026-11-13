/* Los filtros de Reportes en la URL: se leen repetidos o con comas, los años de ingreso como rangos, y se escriben
   cortos para que el enlace se pueda compartir y leer. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activeCount,
  cohortsOf,
  cohortsText,
  filtersFromParams,
  hrefOf,
  listFromParams,
  paramsOf,
  studentIdFrom
} from '@/components/reports/params'

test('los años de ingreso se leen sueltos o como rango, sin repetir y en orden', () => {
  assert.deepEqual(cohortsOf(['2024', '2019-2021', '2020', 'x', '1990-2050']), [2019, 2020, 2021, 2024])
  assert.deepEqual(cohortsOf(['2022-2020']), [2020, 2021, 2022])
})

test('los años consecutivos se escriben como rango', () => {
  assert.equal(cohortsText([2024, 2019, 2020, 2021, 2023]), '2019-2021,2023,2024')
  assert.equal(cohortsText([2012]), '2012')
})

test('los filtros se leen de la URL con comas o repetidos y lo que no existe se descarta', () => {
  const filters = filtersFromParams({
    anio: '2021',
    facultad: ['fi', 'fce'],
    sede: 'Pilar,Rosario',
    ingreso: '2018-2020',
    estado: 'baja,cualquiera',
    indicador: 'aplazos',
    'creditos-hasta': '5',
    'avance-desde': 'mucho'
  })
  assert.equal(filters.year, 2021)
  assert.deepEqual(filters.schools, ['fi', 'fce'])
  assert.deepEqual(filters.campuses, ['Pilar', 'Rosario'])
  assert.deepEqual(filters.cohorts, [2018, 2019, 2020])
  assert.deepEqual(filters.statuses, ['baja'])
  assert.deepEqual(filters.risks, ['aplazos'])
  assert.equal(filters.creditsMax, 5)
  assert.equal(filters.progressMin, null)
  assert.equal(filtersFromParams({}).year, undefined)
})

test('búsqueda, orden y página tienen valores por defecto', () => {
  assert.deepEqual(listFromParams({}), { search: '', sort: 'nombre', order: 'asc', page: 1 })
  assert.deepEqual(listFromParams({ buscar: ' Pérez, Ana ', orden: 'avance', sentido: 'desc', pagina: '3' }), {
    search: 'Pérez, Ana',
    sort: 'avance',
    order: 'desc',
    page: 3
  })
  assert.equal(listFromParams({ orden: 'cualquiera', pagina: '-2' }).sort, 'nombre')
})

test('la URL se escribe corta y vuelve a leerse igual', () => {
  const href = hrefOf('/reportes/alumnos', {
    year: 2026,
    schools: ['fi', 'fce'],
    programs: [],
    cohorts: [2022, 2023, 2024, 2025, 2026],
    statuses: ['activo'],
    creditsMax: 5,
    progressMin: null,
    search: 'aguilar',
    sort: 'nombre',
    order: 'asc',
    page: 1
  })
  assert.equal(
    href,
    '/reportes/alumnos?anio=2026&facultad=fi%2Cfce&ingreso=2022-2026&estado=activo&creditos-hasta=5&buscar=aguilar'
  )
  const params = Object.fromEntries(new URL(href, 'https://example.edu.ar').searchParams.entries())
  assert.deepEqual(filtersFromParams(params).cohorts, [2022, 2023, 2024, 2025, 2026])
  assert.equal(paramsOf({}).toString(), '')
})

test('el botón de filtros del celular cuenta cada filtro de perfil una vez', () => {
  const base = {
    year: 2026,
    schools: ['fi'],
    programs: [],
    campuses: ['Pilar', 'Rosario'],
    cohorts: [],
    statuses: [],
    risks: [],
    creditsMin: null,
    creditsMax: 5,
    progressMin: 10,
    progressMax: 90,
    followed: false
  }
  assert.equal(activeCount(base), 4)
})

test('el legajo del segmento se decodifica, y un % mal formado no es un legajo', () => {
  assert.equal(studentIdFrom('240001'), '240001')
  assert.equal(studentIdFrom('24%2D0001'), '24-0001')
  assert.equal(studentIdFrom('%zz'), null)
})
