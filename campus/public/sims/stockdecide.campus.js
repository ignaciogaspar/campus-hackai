/*
 * StockDecide · instrumentación para el campus.
 * Envuelve las funciones globales del simulador (guardarSKU, runMC, calcFin…)
 * para registrar eventos, y guarda SKUS/CLIENTES/CANJES en la corrida para
 * retomar desde cualquier dispositivo. No cambia los cálculos.
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
  function val(id) { var el = document.getElementById(id); return el ? el.value : null }
  function num(id) { return +val(id) }
  function debounce(fn, ms) {
    var t = null
    return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a) }, ms) }
  }

  var INPUTS = ['tasaMens', 'bonAntic', 'bonVol', 'diasPago', 'capPropio', 'capSGR', 'margenBruto',
    'factorH', 'semPico', 'campRef', 'mcDemSd', 'mcPrecSd', 'mcTasaRng',
    'eOptDem', 'eOptSoja', 'eOptTasa', 'eBaseDem', 'eBaseSoja', 'eBaseTasa', 'ePesDem', 'ePesSoja', 'ePesTasa',
    'pSoja', 'pMaiz', 'pTrigo']

  function snapshot() {
    var inputs = {}
    INPUTS.forEach(function (id) { inputs[id] = val(id) })
    return { v: 1, skus: SKUS, clientes: CLIENTES, canjes: CANJES, inputs: inputs }
  }

  // Mismas fórmulas que calcFin y renderStock, solo para el resumen.
  function kpis() {
    var inv = SKUS.reduce(function (a, s) { return a + s.stock * s.precio }, 0)
    var tasa = num('tasaMens') / 100, bonA = num('bonAntic') / 100, dias = num('diasPago'), mb = num('margenBruto') / 100
    var costoM = inv * tasa
    var neto = inv * bonA - costoM * (dias / 30)
    var quiebres = SKUS.filter(function (s) { return cob(s.stock, s.dem60) < 15 }).length
    var sobre = SKUS.filter(function (s) { return cob(s.stock, s.dem60) > 90 }).length
    var oc = SKUS.reduce(function (a, s) { return a + compSug(s) * s.precio }, 0)
    var deuda = CLIENTES.reduce(function (a, cl) { return a + Math.abs(Math.min(0, cl.saldo)) }, 0)
    return {
      skus: SKUS.length,
      capital_inmovilizado: Math.round(inv),
      costo_financiero_mes: Math.round(costoM),
      margen_neto_mes: Math.round(inv * mb / 12 - costoM),
      quiebres: quiebres,
      sobrestock: sobre,
      orden_compra: Math.round(oc),
      conviene_anticipar: neto > 0,
      neto_anticipar: Math.round(neto),
      capital_gap: Math.round(num('capPropio') + num('capSGR') - inv),
      deuda_clientes: Math.round(deuda),
      productores_mora: CLIENTES.filter(function (cl) { return cl.mora > 0 }).length,
      contratos_canje: CANJES.length,
      tasa_mensual: num('tasaMens'),
    }
  }

  var persist = debounce(function () { c.saveState(snapshot()) }, 1200)

  wrap('ST', function (name) { c.emit('tab.viewed', { tab: name }) })
  wrap('guardarSKU', function () { c.emit('sku.saved', { skus: SKUS.length }); persist() })
  wrap('deleteSKU', function () { c.emit('sku.deleted', { skus: SKUS.length }); persist() })
  wrap('guardarCliente', function () { c.emit('client.saved', { clientes: CLIENTES.length }); persist() })
  wrap('deleteCliente', function () { c.emit('client.deleted', { clientes: CLIENTES.length }); persist() })
  wrap('guardarCanje', function () { c.emit('swap.saved', { canjes: CANJES.length }); persist() })
  wrap('deleteCanje', function () { c.emit('swap.deleted', { canjes: CANJES.length }); persist() })
  wrap('calcDemanda', debounce(function () {
    c.emit('demand.calculated', { factor: num('factorH'), semanas_pico: num('semPico'), campania_ref: val('campRef') })
    persist()
  }, 1500))
  wrap('calcFin', debounce(function () {
    var k = kpis()
    c.emit('finance.evaluated', { tasa: k.tasa_mensual, bonif_anticipada: num('bonAntic'), dias_pago: num('diasPago'), conviene_anticipar: k.conviene_anticipar, neto_anticipar: k.neto_anticipar })
    persist()
  }, 2000))
  wrap('runMC', function () {
    var vals = Array.prototype.map.call(document.querySelectorAll('#mcResults .mc-r-v'), function (el) { return el.textContent })
    c.emit('montecarlo.run', {
      dem_sd: num('mcDemSd'), precio_sd: num('mcPrecSd'), tasa_rango: num('mcTasaRng'),
      p10: vals[0] || null, p50: vals[1] || null, p90: vals[2] || null, prob_negativo: vals[3] || null,
    })
    persist()
  })
  wrap('calcEsc', debounce(function () { c.emit('scenarios.evaluated', {}); persist() }, 1500))
  wrap('abrirReporte', function () { c.emit('report.opened', kpis()) })
  wrap('exportarDatos', function () { c.emit('data.exported', {}) })
  wrap('enviarEstados', function () { c.emit('statements.sent', {}) })

  c.finishButton({
    label: 'Registrar mi análisis',
    title: 'Guarda en el campus los indicadores del inventario y tu decisión de compra',
    doneText: 'Análisis registrado en el campus.',
    onClick: function () {
      var k = kpis()
      c.decision('anticipar', k.conviene_anticipar ? 'si' : 'no', {
        label: '¿Conviene comprar anticipado?', valueLabel: k.conviene_anticipar ? 'Sí, anticipar' : 'No, esperar plazo',
      })
      c.decision('margen', k.margen_neto_mes >= 0 ? 'positivo' : 'negativo', {
        label: 'Margen neto mensual', valueLabel: k.margen_neto_mes >= 0 ? 'Positivo' : 'Negativo',
      })
      var headline = (k.conviene_anticipar ? 'Anticipar compra' : 'No anticipar') + ' · ' + k.quiebres + ' quiebres'
      return c.complete({ score: null, summary: Object.assign({ headline: headline }, k), state: snapshot() })
    },
  })

  c.start({ sim: 'stockdecide', version: 'v2' }).then(function (run) {
    var st = run && run.state
    if (!st || !Array.isArray(st.skus)) { c.emit('opened', {}); return }
    function apply() {
      SKUS = st.skus
      CLIENTES = Array.isArray(st.clientes) ? st.clientes : CLIENTES
      CANJES = Array.isArray(st.canjes) ? st.canjes : CANJES
      function next(list) { return list.length ? Math.max.apply(null, list.map(function (x) { return x.id })) + 1 : 1 }
      nextId.sku = next(SKUS); nextId.cli = next(CLIENTES); nextId.can = next(CANJES)
      if (st.inputs) Object.keys(st.inputs).forEach(function (id) {
        var el = document.getElementById(id)
        if (el && st.inputs[id] !== null && st.inputs[id] !== undefined) el.value = st.inputs[id]
      })
      save()
      renderStock(); renderClientes(); calcDemanda(); renderCanje(); renderCC(); renderRisk()
      c.emit('resumed', {})
      c.toast('Retomamos tu última sesión en StockDecide.')
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 0) })
    else setTimeout(apply, 0)
  })
})()
