/*
 * AgroDecide · instrumentación para el campus.
 * Se carga DESPUÉS del script original y solo envuelve sus funciones globales
 * (setProfile, setRisk, calcAll, …): llama a la original y después registra.
 * No toca cálculos ni DOM del simulador, salvo el botón flotante del SDK.
 */
(function () {
  'use strict'
  var c = window.campus
  if (!c || !c.inCampus) return

  function wrap(name, after) {
    var orig = window[name]
    if (typeof orig !== 'function') return
    window[name] = function () {
      var out = orig.apply(this, arguments)
      try { after.apply(null, arguments) } catch (e) { console.warn('[campus] ' + name, e) }
      return out
    }
  }
  function r0(n) { return typeof n === 'number' && isFinite(n) ? Math.round(n) : null }
  function r1(n) { return typeof n === 'number' && isFinite(n) ? Math.round(n * 10) / 10 : null }
  function cap(s) { return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s }

  // ---------- lectura del estado del simulador ----------
  function fields() {
    var out = {}
    document.querySelectorAll('.field-input[id]').forEach(function (el) { out[el.id] = el.value })
    return out
  }
  function snapshot() {
    return {
      v: 1,
      fields: fields(),
      profile: appState.profile,
      risks: Object.assign({}, appState.risks),
      modo: appModo,
      rot: appState['campañas_rot'] || [],
    }
  }
  function resultado() {
    if (!appState._lastCalcDone || !appState._lastP || !appState.mcResults) return null
    var p = appState._lastP, ec = appState._lastEc, eq = appState._lastEq, mc = appState.mcResults
    var s = calcScore(p, ec, eq, mc)
    return {
      score: r0(s.pct),
      recomendacion: s.recomendacion,
      perfil: appState.profile,
      campo: p.campo,
      cultivo: p.cultivo,
      superficie: p.superficie,
      modo_negocio: p.modo_negocio,
      modalidad: p.modalidad,
      arr_qq: p.arr_qq,
      rinde_prob: p.rinde_prob,
      precio_prob: p.precio_prob,
      margen_ha: r0(ec.margen_final_ha),
      margen_total: r0(ec.margen_final_ha * p.superficie),
      rinde_equilibrio_qq: r1(eq.rinde_eq_qq),
      prob_perdida: r1(mc.prob_perdida),
      prob_objetivo: r1(mc.prob_objetivo),
      p5: r0(mc.p5),
      p95: r0(mc.p95),
      riesgos: Object.assign({}, appState.risks),
    }
  }

  // ---------- eventos ----------
  wrap('setProfile', function (p) {
    c.decision('perfil', p, { label: 'Perfil de decisión', valueLabel: cap(p) })
  })
  wrap('setRisk', function (key, val) {
    c.decision('riesgo.' + key, val, { label: 'Riesgo ' + key, valueLabel: cap(val) })
  })
  wrap('setModoApp', function (modo) { c.emit('mode.changed', { modo: modo }) })
  wrap('loadExample', function () { c.emit('example.loaded', {}) })
  wrap('aplicarPatron', function () {
    var el = document.getElementById('rot_patron')
    if (el && el.value) c.decision('rotacion.patron', el.value, { label: 'Patrón de rotación', valueLabel: el.options[el.selectedIndex].text })
  })
  wrap('calcRotAll', function () {
    var rot = appState._lastRot, mc = appState._lastMCRot
    if (!rot) return
    c.emit('rotation.calculated', {
      campañas: (appState['campañas_rot'] || []).length,
      van_base: r0(rot.van_base), van_pes: r0(rot.van_pes),
      prob_neg_van: mc ? r1(mc.prob_neg_van) : null,
    })
    c.saveState(snapshot())
  })
  wrap('generarReporte', function () { c.emit('report.generated', resultado() || {}) })

  var lastTab = null
  wrap('showTab', function (id) {
    if (id === lastTab) return
    lastTab = id
    c.emit('tab.viewed', { tab: id })
    if (id === 'tab-recomendacion') c.emit('recommendation.viewed', resultado() || {})
  })

  // calcAll corre en cada tecla (con debounce propio): registramos el escenario
  // evaluado como mucho cada 2,5 s y guardamos el estado para retomar.
  var evalTimer = null
  var restoring = false
  wrap('calcAll', function () {
    if (restoring) return
    clearTimeout(evalTimer)
    evalTimer = setTimeout(function () {
      var r = resultado()
      if (r) c.emit('scenario.evaluated', r)
      c.saveState(snapshot())
    }, 2500)
  })

  // ---------- cierre ----------
  c.finishButton({
    label: 'Registrar mi recomendación',
    title: 'Guarda en el campus el escenario actual, el score y la recomendación',
    doneText: 'Recomendación registrada en el campus.',
    onClick: function () {
      var r = resultado()
      if (!r) throw new Error('Primero calculá el escenario (⟳ Recalcular).')
      c.decision('recomendacion', r.recomendacion, { label: 'Recomendación final', valueLabel: r.recomendacion })
      c.decision('cultivo', r.cultivo, { label: 'Cultivo' })
      c.decision('modalidad', r.modalidad, { label: 'Modalidad de arrendamiento' })
      return c.complete({
        score: r.score,
        summary: Object.assign({ headline: r.recomendacion + ' · ' + r.cultivo + ' · perfil ' + r.perfil }, r),
        state: snapshot(),
      })
    },
  })

  // ---------- retomar ----------
  function afterLoad(fn) {
    if (document.readyState === 'complete') setTimeout(fn, 0)
    else window.addEventListener('load', function () { setTimeout(fn, 0) })
  }

  c.start({ sim: 'agrodecide', version: 'v4' }).then(function (run) {
    var st = run && run.state
    if (!st || !st.fields) { c.emit('opened', {}); return }
    afterLoad(function () {
      restoring = true
      try {
        Object.keys(st.fields).forEach(function (id) {
          var el = document.getElementById(id)
          if (el && el.classList.contains('field-input')) el.value = st.fields[id]
        })
        if (st.profile) appState.profile = st.profile
        if (st.risks) appState.risks = Object.assign({}, appState.risks, st.risks)
        if (Array.isArray(st.rot)) appState['campañas_rot'] = st.rot
        updateModoNegocio()
        updateModalidadFields()
        updateRotSidebar()
        updateRotArrFields()
        syncProfiles()
        calcAll()
        if (st.modo === 'rotacion') setModoApp('rotacion')
      } finally {
        restoring = false
      }
      c.emit('resumed', {})
      c.toast('Retomamos tu última sesión en AgroDecide.')
    })
  })
})()
