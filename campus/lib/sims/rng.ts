// RNG determinístico (portado de ../mbt lib/seed/rng.ts y lib/sim/engine.ts).
// Los motores de los sims nunca usan Math.random: misma clave → mismo orden.

/** Hash 31: estable entre corridas. */
export function hashStr(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** RNG derivado de una clave compuesta, p.ej. rngFor(personId, 'triage', 'v1'). */
export function rngFor(...keys: string[]): () => number {
  return mulberry32(hashStr(keys.join(':')))
}

/** RNG de una ronda (adopción). */
export function roundRng(seed: number, round: number): () => number {
  return mulberry32((seed + round + 1) >>> 0)
}
