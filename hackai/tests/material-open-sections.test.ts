/* Qué secciones del material se ven abiertas al entrar: las que tienen algo nuevo y la del archivo más nuevo. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openMaterialSections } from '@/components/spaces/format'
import type { MaterialItem, MaterialSection, MaterialView } from '@/lib/core/spaces'

function item(id: string, unread = false): MaterialItem {
  return {
    id,
    kind: 'archivo',
    name: `${id}.pdf`,
    url: `/archivos/${id}`,
    contentType: 'application/pdf',
    size: 1000,
    origin: 'hackai',
    section: null,
    addedBy: null,
    addedAt: '2026-11-10T15:00:00.000Z',
    unread,
    files: [],
    text: null,
    activity: null,
    position: null
  }
}

function view(sections: MaterialSection[], recent: MaterialItem[]): MaterialView {
  return { layout: 'unidad', sections, sectionNames: sections.map((s) => s.title), recent }
}

test('se abre la sección del archivo más nuevo, aunque no sea la primera', () => {
  const guide = item('guia-derivadas')
  const material = view(
    [
      { title: 'Bibliografía', items: [item('libro')] },
      { title: 'Unidad 2: Derivadas', items: [guide] }
    ],
    [guide]
  )
  assert.deepEqual(openMaterialSections(material), ['Unidad 2: Derivadas'])
})

test('también se abre toda sección con algún archivo nuevo', () => {
  const newest = item('tp')
  const material = view(
    [
      { title: 'Bibliografía', items: [item('libro', true)] },
      { title: 'Unidad 1', items: [item('guia-1')] },
      { title: 'Unidad 2', items: [newest, item('guia-2', true)] }
    ],
    [newest]
  )
  assert.deepEqual(openMaterialSections(material), ['Bibliografía', 'Unidad 2'])
})

test('sin material no se abre nada', () => {
  assert.deepEqual(openMaterialSections(view([], [])), [])
})
