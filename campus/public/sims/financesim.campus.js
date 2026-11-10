/*
 * FinanceSim Builder · instrumentación para el campus.
 * El builder vive en una IIFE (sin globales), así que solo escuchamos el DOM:
 * etapas, plantilla, modo, capacidades, prompts y descargas. La corrida se
 * completa al descargar el simulador HTML generado. No cambia la lógica.
 */
(function () {
  'use strict'
  var c = window.campus
  if (!c || !c.inCampus) return

  var LS_KEY = 'iae-financesim-builder-v2'
  var MODULE_NAMES = {
    scenarios: 'Escenarios', monteCarlo: 'Monte Carlo', tornado: 'Sensibilidad individual',
    heatmap: 'Mapa de sensibilidad', comparison: 'Comparación de alternativas', alerts: 'Alertas y umbrales',
  }
  function $(s) { return document.querySelector(s) }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)) }
  function text(s) { var el = $(s); return el ? (el.value !== undefined ? el.value : el.textContent).trim() : '' }

  function savedBuilder() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch (e) { return null }
  }
  function modules() {
    var out = {}
    $$('[data-module]').forEach(function (el) { out[el.dataset.module] = el.checked })
    return out
  }
  function ficha() {
    var sel = $('#templateSelect')
    return {
      titulo: text('#simTitle'),
      usuario: text('#audience'),
      decision: text('#decision'),
      moneda: text('#currency'),
      horizonte: text('#horizon'),
      plantilla: sel ? sel.value : null,
      modo: document.body.classList.contains('advanced') ? 'avanzado' : 'guiado',
      estrategia_datos: (function () { var r = $('input[name="dataStrategy"]:checked'); return r ? r.value : null })(),
      variables: $$('#inputsBody tr').length,
      resultados: $$('#outputsBody tr').length,
      capacidades: Object.keys(modules()).filter(function (k) { return modules()[k] }),
      no_delegable: text('#nonDelegable').slice(0, 400),
    }
  }

  var lastStep = null
  function readStep() {
    var st = $('.stage.active')
    var n = st ? Number(st.dataset.step) : null
    if (n !== null && n !== lastStep) {
      lastStep = n
      c.emit('step.viewed', { step: n })
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('[data-step-button],[data-next],[data-prev]')) setTimeout(readStep, 0)
    if (t.closest('#loadTemplate')) {
      var sel = $('#templateSelect')
      if (sel) c.decision('plantilla', sel.value, { label: 'Plantilla de partida', valueLabel: sel.options[sel.selectedIndex].text })
    }
    if (t.closest('#guidedMode')) c.decision('modo', 'guiado', { label: 'Modo del builder', valueLabel: 'Guiado' })
    if (t.closest('#advancedMode')) c.decision('modo', 'avanzado', { label: 'Modo del builder', valueLabel: 'Avanzado' })
    if (t.closest('#addInput')) c.emit('input.added', {})
    if (t.closest('#addOutput')) c.emit('output.added', {})
    if (t.closest('#parsePaste')) c.emit('data.pasted', {})
    if (t.closest('#refreshDeliverables')) c.emit('deliverables.refreshed', {})
    if (t.closest('#resetBuilder')) c.emit('builder.reset', {})
    var copy = t.closest('[data-copy]')
    if (copy) c.emit('prompt.copied', { prompt: copy.getAttribute('data-copy') })
    var dl = t.closest('[data-download-prompt]')
    if (dl && !dl.disabled) c.emit('prompt.downloaded', { prompt: dl.getAttribute('data-download-prompt') })
    if (t.closest('#downloadConfig') && !$('#downloadConfig').disabled) c.emit('config.downloaded', ficha())
    if (t.closest('#saveDraft')) {
      setTimeout(function () {
        var b = savedBuilder()
        if (b) c.saveState({ v: 1, builder: b })
        c.emit('draft.saved', {})
      }, 50)
    }
    if (t.closest('#downloadSimulator') && !$('#downloadSimulator').disabled) finish()
  }, true)

  document.addEventListener('change', function (e) {
    var t = e.target
    if (!(t instanceof HTMLElement)) return
    if (t.dataset.module) c.emit('module.toggled', { module: t.dataset.module, on: t.checked })
    if (t.closest('#builderValidations')) c.emit('validation.checked', { checked: $$('#builderValidations input:checked').length })
    if (t.id === 'dataFile') c.emit('data.uploaded', {})
  }, true)

  function finish() {
    var f = ficha()
    var mods = modules()
    Object.keys(MODULE_NAMES).forEach(function (k) {
      c.decision('capacidad.' + k, mods[k] ? 'si' : 'no', { label: MODULE_NAMES[k], valueLabel: mods[k] ? 'Incluida' : 'No incluida' })
    })
    var b = savedBuilder()
    c.complete({
      score: null,
      summary: Object.assign({ headline: (f.titulo || 'Simulador') + ' · ' + f.capacidades.length + ' capacidades' }, f),
      state: b ? { v: 1, builder: b } : undefined,
    }).then(function () { c.toast('Simulador generado y registrado en el campus.') })
  }

  c.start({ sim: 'financesim', version: 'v2' }).then(function (run) {
    var st = run && run.state
    // Si el campus tiene un borrador y este navegador no, lo cargamos y recargamos una vez.
    if (st && st.builder && !localStorage.getItem(LS_KEY) && !sessionStorage.getItem('campus-financesim-restored')) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(st.builder))
        sessionStorage.setItem('campus-financesim-restored', '1')
        window.location.reload()
        return
      } catch (e) { /* sin storage: seguimos con lo que hay */ }
    }
    c.emit('opened', { con_borrador: Boolean(savedBuilder()) })
    readStep()
  })
})()
