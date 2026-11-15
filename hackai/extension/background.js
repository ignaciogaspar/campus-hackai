/* Inicia sesión en el SIU y en el Campus Virtual por quien toca «Iniciar con mi cuenta» en HackAI, y le da a HackAI
   las dos cookies de sesión (ADR 0011). Si ya hay sesión abierta, no abre nada; si no, abre el login de la Austral
   en una pestaña, espera a que la persona entre con su cuenta de Microsoft, la cierra y vuelve a HackAI.
   Solo responde a su content script, que corre únicamente en los orígenes de HackAI del manifest. Nunca guarda ni
   registra los valores. */
const SIU = {
  domain: 'siu.austral.edu.ar',
  cookie: 'siu_sess__portal_ua_UA',
  login: 'https://siu.austral.edu.ar/portal/acceso?auth=saml'
}
const CAMPUS = {
  domain: 'campusvirtual.austral.edu.ar',
  cookie: 'MoodleSession',
  // El botón «Entrar» de las cuentas @austral de /newlogin.php: el login con Microsoft (auth_oidc). Con la sesión de
  // Microsoft que dejó el SIU, pasa solo, sin elegir el tipo de cuenta ni volver a poner la clave.
  login: 'https://campusvirtual.austral.edu.ar/auth/oidc/'
}
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

// La cookie que el navegador mandaría al sitio; si no la encuentra así, cualquiera de ese nombre en el dominio.
async function cookieOf({ domain, cookie }) {
  const exact = await chrome.cookies.get({ url: `https://${domain}/`, name: cookie })
  if (exact?.value) return exact.value
  const found = await chrome.cookies.getAll({ name: cookie })
  const live = found.filter(
    (item) =>
      domain.endsWith(item.domain.replace(/^\./, '')) &&
      (!item.expirationDate || item.expirationDate * 1000 > Date.now())
  )
  return live[0]?.value ?? null
}

// El SIU sin sesión devuelve la pantalla de acceso con el botón de SAML.
async function siuSignedIn() {
  try {
    const response = await fetch('https://siu.austral.edu.ar/portal/', { credentials: 'include' })
    const html = await response.text()
    return response.ok && !html.includes("op_actual: 'acceso'") && !html.includes('auth=saml')
  } catch {
    return false
  }
}

// Con sesión, el Campus muestra el área personal en /my/; sin sesión redirige a su ingreso (/newlogin.php en la
// Austral, /login/ en un Moodle común).
async function campusSignedIn() {
  try {
    const response = await fetch('https://campusvirtual.austral.edu.ar/my/', { credentials: 'include' })
    const url = new URL(response.url)
    return response.ok && url.hostname === CAMPUS.domain && url.pathname.startsWith('/my')
  } catch {
    return false
  }
}

const CHECKS = { siu: siuSignedIn, campus: campusSignedIn }
const SITES = { siu: SIU, campus: CAMPUS }

/** Espera a que la pestaña termine de cargar una página del sitio y el sitio diga que hay sesión. */
function waitForSignIn(tabId, site, check) {
  return new Promise((resolve) => {
    const finish = (ok) => {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.tabs.onRemoved.removeListener(onRemoved)
      resolve(ok)
    }
    const onUpdated = async (id, change, tab) => {
      if (id !== tabId || change.status !== 'complete' || !tab.url) return
      if (new URL(tab.url).hostname !== site.domain) return
      if (await check()) finish(true)
    }
    const onRemoved = (id) => {
      if (id === tabId) finish(false)
    }
    const timer = setTimeout(() => finish(false), LOGIN_TIMEOUT_MS)
    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.onRemoved.addListener(onRemoved)
  })
}

/** Deja iniciada la sesión de cada sitio, abriendo el login solo en los que falta, y devuelve las cookies. */
async function signIn(wanted, returnTab) {
  let loginTab = null
  for (const name of wanted) {
    if (await CHECKS[name]()) continue
    const site = SITES[name]
    if (loginTab) await chrome.tabs.update(loginTab.id, { url: site.login, active: true })
    else loginTab = await chrome.tabs.create({ url: site.login, active: true })
    const ok = await waitForSignIn(loginTab.id, site, CHECKS[name])
    if (!ok) break
  }
  if (loginTab) {
    await chrome.tabs.remove(loginTab.id).catch(() => {})
    await chrome.tabs.update(returnTab.id, { active: true }).catch(() => {})
    await chrome.windows.update(returnTab.windowId, { focused: true }).catch(() => {})
  }
  // Sin valores en `motivos`: solo por qué faltó una sesión, para el mensaje de HackAI.
  const result = { motivos: {} }
  for (const name of wanted) {
    const signedIn = await CHECKS[name]()
    result[name] = signedIn ? await cookieOf(SITES[name]) : null
    if (!result[name]) result.motivos[name] = signedIn ? 'sin-cookie' : 'sin-sesion'
  }
  return result
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !sender.tab) return false
  if (message?.type !== 'iniciar') return false
  const wanted = (Array.isArray(message.sites) ? message.sites : []).filter((name) => name in SITES)
  signIn(wanted.length ? wanted : ['siu', 'campus'], sender.tab).then(reply, () => reply(null))
  return true
})
