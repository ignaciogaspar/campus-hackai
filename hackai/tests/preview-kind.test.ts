/* Qué archivos del espacio se abren en la vista previa: un PDF o una imagen
   servidos desde HackAI. Lo de otro sitio no se deja embeber y se abre aparte. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewKind } from '@/components/spaces/preview-kind'

test('un PDF o una imagen de nuestro origen se previsualizan', () => {
  assert.equal(previewKind('/archivos/f-1/guia.pdf', 'guia.pdf', 'application/pdf'), 'pdf')
  // El material de Moodle se llama como el recurso, sin extensión: alcanza con el tipo.
  assert.equal(previewKind('/simulado/moodle/pluginfile.php/c/guia-1.pdf', 'Guía 1', 'application/pdf'), 'pdf')
  assert.equal(previewKind('/archivos/f-2/foto.png', 'foto.png', 'image/png'), 'imagen')
})

test('lo de otro sitio o lo que no es PDF ni imagen se abre en otra pestaña', () => {
  assert.equal(previewKind('https://cdn.discordapp.com/a/b/guia.pdf', 'guia.pdf', 'application/pdf'), null)
  assert.equal(previewKind('//otro.sitio/guia.pdf', 'guia.pdf', 'application/pdf'), null)
  assert.equal(previewKind('/archivos/f-3/planilla.xlsx', 'planilla.xlsx', 'application/vnd.ms-excel'), null)
  assert.equal(previewKind('/archivos/f-4/dibujo.svg', 'dibujo.svg', 'image/svg+xml'), null)
})
