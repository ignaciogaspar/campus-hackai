/*
 * Campus SDK para simuladores HTML (v1).
 *
 * El simulador corre en un iframe dentro de /campus/sims/<id>. Este script
 * habla con la página padre (components/sims/SimFrame.tsx) por postMessage;
 * el padre crea la corrida (sim_runs) y persiste los eventos (sim_events).
 * Abierto suelto (sin campus), todo funciona igual y el SDK no hace nada.
 *
 *   campus.start(meta)                  → Promise<{runId, state, resumed, person} | null>
 *   campus.emit(type, payload)          → registra un evento (verbo estilo xAPI)
 *   campus.decision(key, value, extra)  → emit('decision', {key, value, label?, valueLabel?})
 *   campus.getState()                   → Promise<object | null> (estado guardado para retomar)
 *   campus.saveState(state)             → guarda el estado (con debounce)
 *   campus.complete({score, summary})   → Promise: cierra la corrida
 *   campus.finishButton({label, onClick}) → botón flotante "Terminar y registrar"
 *   campus.toast(texto)                 → aviso breve
 *   campus.inCampus                     → true si corre dentro del campus
 */
(function () {
  'use strict'
  if (window.campus && window.campus.__v) return

  var inCampus = false
  try { inCampus = window.parent && window.parent !== window } catch (e) { inCampus = false }

  var origin = window.location.origin
  var seq = 0
  var pending = {}
  var readyResolve
  var readyValue = null
  var started = false
  var stateTimer = null
  var lastState = null
  var ready = new Promise(function (resolve) { readyResolve = resolve })

  function post(cmd, payload, wantReply) {
    if (!inCampus) return Promise.resolve(null)
    var msg = { __campus: 'sim', v: 1, cmd: cmd, payload: payload || {} }
    if (!wantReply) {
      window.parent.postMessage(msg, origin)
      return Promise.resolve(null)
    }
    var id = 'm' + (++seq)
    msg.id = id
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject }
      window.parent.postMessage(msg, origin)
      setTimeout(function () {
        if (pending[id]) { delete pending[id]; reject(new Error('El campus no respondió (' + cmd + ')')) }
      }, 15000)
    })
  }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== origin || ev.source !== window.parent) return
    var m = ev.data
    if (!m || m.__campus !== 'host') return
    if (m.replyTo && pending[m.replyTo]) {
      var p = pending[m.replyTo]
      delete pending[m.replyTo]
      if (m.ok) p.resolve(m.data); else p.reject(new Error(m.error || 'Error del campus'))
      return
    }
    if (m.event === 'flush') flushState()
  })

  function start(meta) {
    if (started) return ready
    started = true
    if (!inCampus) { readyResolve(null); return ready }
    var tries = 0
    function hello() {
      tries++
      post('hello', { meta: meta || {}, href: window.location.pathname }, true).then(function (data) {
        readyValue = data
        readyResolve(data)
      }).catch(function () {
        if (tries < 4) setTimeout(hello, 800)
        else readyResolve(null)
      })
    }
    hello()
    return ready
  }

  function emit(type, payload) {
    if (!inCampus || !type) return
    post('emit', { events: [{ type: String(type), payload: payload || {}, at: Date.now() }] }, false)
  }

  function decision(key, value, extra) {
    var p = { key: String(key), value: String(value) }
    if (extra && typeof extra === 'object') {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k]
    }
    emit('decision', p)
  }

  function getState() {
    if (!inCampus) return Promise.resolve(null)
    return ready.then(function (r) {
      return r && r.state && Object.keys(r.state).length ? r.state : null
    })
  }

  function flushState() {
    if (stateTimer) { clearTimeout(stateTimer); stateTimer = null }
    if (lastState) post('state.save', { state: lastState }, false)
  }

  function saveState(state) {
    if (!inCampus || !state || typeof state !== 'object') return
    lastState = state
    if (stateTimer) clearTimeout(stateTimer)
    stateTimer = setTimeout(flushState, 800)
  }

  function complete(result) {
    result = result || {}
    flushState()
    if (!inCampus) return Promise.resolve(null)
    return ready.then(function () {
      return post('complete', { score: result.score, summary: result.summary || {}, state: result.state }, true)
    })
  }

  // ---------- UI mínima (botón flotante y aviso) ----------
  var css = '' +
    '.campus-sdk-fin{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;gap:8px;align-items:center;' +
    'font-family:Montserrat,system-ui,sans-serif}' +
    '.campus-sdk-fin button{background:#1d21a9;color:#fff;border:0;border-radius:999px;padding:11px 18px;font-weight:700;' +
    'font-size:13px;cursor:pointer;box-shadow:0 6px 20px rgba(29,33,169,.35)}' +
    '.campus-sdk-fin button:disabled{opacity:.55;cursor:default}' +
    '.campus-sdk-fin button:hover:not(:disabled){background:#14178a}' +
    '.campus-sdk-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483001;background:#10142c;' +
    'color:#fff;padding:10px 16px;border-radius:8px;font:600 13px Montserrat,system-ui,sans-serif;opacity:0;transition:opacity .2s}' +
    '.campus-sdk-toast.on{opacity:1}'

  function injectCss() {
    if (document.getElementById('campus-sdk-css')) return
    var s = document.createElement('style')
    s.id = 'campus-sdk-css'
    s.textContent = css
    document.head.appendChild(s)
  }

  var toastEl = null
  var toastTimer = null
  function toast(text) {
    injectCss()
    if (!toastEl) {
      toastEl = document.createElement('div')
      toastEl.className = 'campus-sdk-toast'
      toastEl.setAttribute('role', 'status')
      document.body.appendChild(toastEl)
    }
    toastEl.textContent = text
    toastEl.classList.add('on')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { toastEl.classList.remove('on') }, 2600)
  }

  function finishButton(opts) {
    opts = opts || {}
    if (!inCampus) return { remove: function () {}, setLabel: function () {} }
    injectCss()
    var wrap = document.createElement('div')
    wrap.className = 'campus-sdk-fin'
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = opts.label || 'Terminar y registrar en el campus'
    if (opts.title) btn.title = opts.title
    btn.addEventListener('click', function () {
      btn.disabled = true
      Promise.resolve().then(function () { return opts.onClick ? opts.onClick() : null }).then(function () {
        toast(opts.doneText || 'Listo: quedó registrado en el campus.')
      }).catch(function (err) {
        toast((err && err.message) || 'No se pudo registrar. Probá de nuevo.')
      }).then(function () { btn.disabled = false })
    })
    wrap.appendChild(btn)
    function mount() { document.body.appendChild(wrap) }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount)
    return {
      remove: function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap) },
      setLabel: function (t) { btn.textContent = t },
    }
  }

  window.addEventListener('pagehide', flushState)

  window.campus = {
    __v: 1,
    inCampus: inCampus,
    ready: ready,
    start: start,
    emit: emit,
    decision: decision,
    getState: getState,
    saveState: saveState,
    complete: complete,
    finishButton: finishButton,
    toast: toast,
    get run() { return readyValue },
  }
})()
