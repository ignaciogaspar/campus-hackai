/* Instrumentación local para Next: solo imprime tabla y duración, sin URL ni credenciales. */
const fetchOriginal = globalThis.fetch

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input, 'http://localhost')
  const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1]
  if (!table || !url.hostname.endsWith('.supabase.co')) return fetchOriginal(input, init)

  const started = performance.now()
  try {
    return await fetchOriginal(input, init)
  } finally {
    console.log('consulta-supabase', table, Math.round(performance.now() - started))
  }
}
