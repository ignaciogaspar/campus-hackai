/* Compartido por todas las pantallas: íconos, shell (encabezado y navegación
   inferior), query params, pestañas y aviso del alto a la galería.

   Cada pantalla declara en <body>:
     data-active   hoy | materias | academico
     data-title    título del encabezado
     data-sub      subtítulo (opcional)
     data-back     pantalla a la que vuelve la flecha (opcional)
   y define window.render(), que devuelve el HTML de #page.

   Query params: ?rol=alumno|docente, ?carga=normal|alta (7 materias),
   ?estado=normal|vacio|cargando|error|desactualizado|offline, ?pwa=1 (instalada),
   y los propios de cada pantalla. */
(function () {
  const q = new URLSearchParams(location.search)
  const P = {
    carga: q.get('carga') || 'normal',
    pwa: q.get('pwa') === '1',
    rol: q.get('rol') || 'alumno',
    estado: q.get('estado') || 'normal',
    get: (k, d) => q.get(k) || d,
  }

  /* Íconos de trazo, 24 × 24, inline para que anden por file:// */
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    books: '<path d="M4 4h5v16H4z"/><path d="M9 4h5v16H9z"/><path d="m15 5 4.5-1 2.5 15.5-4.5 1z"/>',
    cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    hash: '<path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    megaphone: '<path d="M3 10v4h4l9 5V5L7 10z"/><path d="M19 9a3 3 0 0 1 0 6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clip: '<path d="m20 11-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    sync: '<path d="M4 9a8 8 0 0 1 14-3l2 2"/><path d="M20 4v4h-4"/><path d="M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M4 20v-4h4"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5v.5"/><path d="m3 3 18 18"/>',
  }
  const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[n] || ''}</svg>`

  const ORIGEN = { hackai: 'HackAI', discord: 'Discord', moodle: 'Moodle', siu: 'SIU' }
  const origen = (o) => `<span class="origen" data-o="${o}">${ORIGEN[o]}</span>`

  /* Agrega rol y carga a un link interno, para que la navegación no los pierda */
  const keep = (href) => {
    if (!href || /^(https?:|#|mailto:)/.test(href)) return href
    const [path, qs = ''] = href.split('?')
    const p = new URLSearchParams(qs)
    if (!p.has('rol') && P.rol !== 'alumno') p.set('rol', P.rol)
    if (!p.has('carga') && P.carga !== 'normal') p.set('carga', P.carga)
    if (!p.has('pwa') && P.pwa) p.set('pwa', '1')
    if (!p.has('estado') && P.estado === 'offline') p.set('estado', 'offline')
    const qs2 = p.toString()
    return qs2 ? `${path}?${qs2}` : path
  }

  function shell() {
    const b = document.body.dataset
    const back = b.back
      ? `<a class="icon-btn" href="${keep(b.back)}" aria-label="Volver" ${b.backCompu === 'oculto' ? 'data-oculto-compu' : ''}>${icon('back')}</a>`
      : `<span class="marca"><span class="marca-escudo" aria-hidden="true">UA</span><span><span class="marca-nombre">Universidad Austral</span><span class="marca-fac">${window.HK.facultad}</span></span></span>`
    const persona = P.rol === 'docente' ? window.HK.docente : P.carga === 'alta' ? window.HK.alumnoAlta : window.HK.alumno
    const hdr = document.createElement('header')
    hdr.className = 'hdr'
    hdr.innerHTML = `
      <div class="hdr-bar">
        ${back}
        <div class="hdr-act" id="act">
          ${P.get('instalar') && !P.pwa ? `<button class="instalar-pill" type="button" data-abrir-hoja aria-haspopup="dialog">${icon('download', 'icon-sm')} Instalar</button>` : ''}
          <a class="icon-btn" href="m-novedades.html" aria-label="Novedades, ${window.HK.novedades.length} sin leer">${icon('bell')}<span class="count">${window.HK.novedades.length}</span></a>
          <a class="icon-btn" href="#" aria-label="Tu perfil: ${persona.nombre} ${persona.apellido}"><span class="avatar ${P.rol === 'docente' ? 'docente' : ''}">${persona.iniciales}</span></a>
        </div>
      </div>
      ${b.kicker ? `<p class="hdr-kicker">${b.kicker}</p>` : ''}
      <h1 class="hdr-title">${b.title || ''}</h1>
      ${b.sub ? `<p class="hdr-sub">${b.sub}</p>` : ''}
      <div class="hdr-extra" id="hdr-extra" hidden></div>`
    document.body.prepend(hdr)

    const tabs = [
      ['hoy', 'Hoy', 'home', 'm-hoy.html', 0],
      ['materias', 'Materias', 'books', 'm-materias.html', 0],
      ['academico', 'Académico', 'cap', '#', 0],
    ]
    const nav = document.createElement('nav')
    nav.className = 'tabbar'
    nav.setAttribute('aria-label', 'Navegación principal')
    nav.innerHTML = `<div class="nav-marca marca"><span class="marca-escudo" aria-hidden="true">UA</span><span><span class="marca-nombre">Universidad Austral</span><span class="marca-fac">${window.HK.facultad}</span></span></div>` + tabs.map(([id, label, ic, href, n]) => `
      <a class="tab" href="${keep(href)}" ${b.active === id ? 'aria-current="page"' : ''}>
        <span class="badge-wrap">${icon(ic)}${n ? `<span class="count" aria-label="${n} sin leer">${n}</span>` : ''}</span>${label}
      </a>`).join('') + navMaterias(b.materia)
    document.body.append(nav)
  }

  /* Solo en compu: tus materias en la barra lateral, como los servidores de Discord.
     Con muchas materias, la lista scrollea sola sin empujar al resto. */
  function navMaterias(activa) {
    const D = window.HK[P.carga === 'alta' ? 'alta' : 'normal']
    return `<div class="nav-materias">
      <p class="nav-title">Tus materias</p>
      <div class="nav-materias-lista">${D.materias.map((m, i) => `
        <a class="nav-materia" href="${keep('m-espacio.html')}" ${activa === m.sigla ? 'aria-current="page"' : ''} title="${m.nombre}">
          <span class="materia-sigla mini ${i % 2 ? 'alt' : ''}">${m.sigla}</span>
          <span class="nav-materia-nombre">${m.nombre}</span>
          ${m.noLeidos ? `<span class="count" aria-label="${m.noLeidos} sin leer">${m.noLeidos}</span>` : ''}
        </a>`).join('')}
      </div>
    </div>`
  }

  function tabsInit(root = document) {
    root.querySelectorAll('[role=tablist]').forEach((list) => {
      const btns = [...list.querySelectorAll('[role=tab]')]
      const show = (btn) => {
        btns.forEach((x) => {
          const on = x === btn
          x.setAttribute('aria-selected', on)
          x.tabIndex = on ? 0 : -1
          document.getElementById(x.getAttribute('aria-controls')).hidden = !on
        })
      }
      btns.forEach((btn, i) => {
        btn.addEventListener('click', () => show(btn))
        btn.addEventListener('keydown', (e) => {
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
          if (!d) return
          const next = btns[(i + d + btns.length) % btns.length]
          next.focus()
          show(next)
        })
      })
    })
  }

  function postHeight() {
    if (window.parent === window) return
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    window.parent.postMessage({ hkHeight: h, src: location.pathname.split('/').pop() + location.search }, '*')
  }

  /* PWA instalada (?pwa=1): simula la barra de estado y el indicador de inicio
     del teléfono, que en la app real ocupan env(safe-area-inset-*). */
  function simularPwa() {
    document.documentElement.classList.add('pwa')
    const top = document.createElement('div')
    top.className = 'sim-status'
    top.setAttribute('aria-hidden', 'true')
    top.innerHTML = '<span>9:41</span><span class="sim-icons">●●●● 5G ▮</span>'
    const bottom = document.createElement('div')
    bottom.className = 'sim-home'
    bottom.setAttribute('aria-hidden', 'true')
    document.body.append(top, bottom)
  }

  /* Sin conexión (?estado=offline): se ve lo último guardado y se avisa que
     inscribirse, escribir o subir necesita internet. */
  function sinConexion(page) {
    document.body.classList.add('offline')
    const note = document.createElement('div')
    note.className = 'note note-offline'
    note.setAttribute('role', 'status')
    note.innerHTML = `${icon('wifi')}<div><b>Sin conexión.</b> Te mostramos lo último que guardamos, de hoy a las 11:40. Para inscribirte, escribir o subir material necesitás internet.</div>`
    page.prepend(note)
    document.querySelectorAll('.btn-primary, .composer-box button, .composer-box input').forEach((el) => {
      el.setAttribute('aria-disabled', 'true')
      if ('disabled' in el) el.disabled = true
    })
  }

  /* Hoja para instalar la PWA (?instalar=ios | android, ?hoja=1 la abre). Solo celular. */
  function hojaInstalar() {
    const ios = P.get('instalar') === 'ios'
    const fondo = document.createElement('div')
    fondo.className = 'hoja-fondo'
    fondo.hidden = P.get('hoja') !== '1'
    fondo.innerHTML = `
      <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-t">
        <span class="hoja-asa" aria-hidden="true"></span>
        <div class="hoja-head"><span class="marca-escudo" aria-hidden="true">UA</span>
          <div><h2 id="hoja-t">Tené la app en tu celular</h2><p class="small muted">Se abre desde el ícono, sin el navegador.</p></div></div>
        ${ios ? `<ol>
          <li>Tocá <b>Compartir</b> en la barra de Safari.</li>
          <li>Elegí <b>Agregar a inicio</b>.</li>
          <li>Abrila desde el ícono <b>Austral</b>.</li>
        </ol>
        <div class="acciones"><button class="btn" type="button" data-cerrar-hoja>Listo</button></div>` : `
        <div class="acciones"><button class="btn" type="button" data-cerrar-hoja>Ahora no</button><button class="btn btn-primary" type="button" data-cerrar-hoja>Instalar</button></div>`}
      </div>`
    document.body.append(fondo)
    const cerrar = () => { fondo.hidden = true }
    fondo.addEventListener('click', (e) => { if (e.target === fondo || e.target.closest('[data-cerrar-hoja]')) cerrar() })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar() })
    document.querySelectorAll('[data-abrir-hoja]').forEach((b) => b.addEventListener('click', () => {
      fondo.hidden = false
      fondo.querySelector('button').focus()
    }))
  }

  window.UI = { P, icon, origen, keep, set: () => window.HK[P.carga === 'alta' ? 'alta' : 'normal'] }

  document.addEventListener('DOMContentLoaded', () => {
    shell()
    const page = document.getElementById('page')
    if (typeof window.render === 'function') page.innerHTML = window.render(P)
    if (P.estado === 'offline') sinConexion(page)
    if (P.pwa) simularPwa()
    if (P.get('instalar') && !P.pwa) hojaInstalar()
    if (typeof window.extra === 'function') {
      const ex = document.getElementById('hdr-extra')
      ex.innerHTML = window.extra(P)
      ex.hidden = false
    }
    document.querySelectorAll('a[href]').forEach((a) => a.setAttribute('href', keep(a.getAttribute('href'))))
    document.querySelectorAll('[data-href]').forEach((el) => {
      el.style.cursor = 'pointer'
      el.addEventListener('click', () => { location.href = keep(el.dataset.href) })
    })
    tabsInit()
    postHeight()
    window.addEventListener('load', postHeight)
    new ResizeObserver(postHeight).observe(document.body)
  })
})()
