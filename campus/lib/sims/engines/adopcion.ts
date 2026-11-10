// Simulador «Piloto de Adopción» — Bloque 06 · Dirigir la transformación.
// Motor puro determinístico, patrón lib/sim/engine.ts: sin store, sin Date.now,
// sin Math.random. seed = hashStr(`${userId}:adopcion:${attempt}`); RNG por
// ronda con roundRng(seed, mes) y consumo en ORDEN FIJO (acción 1 → acción 2 →
// evento: variante + jitter) — mismo seed + mismas decisiones → mismo resultado.
// El RNG solo aporta: éxito del piloto, variante de texto de eventos (2 por
// evento) y jitter ±2 en la moral de los eventos; todo lo estructural es
// determinístico por condiciones.
//
// Cierre del arco de dificultad de los sims del programa: cotizacion
// (single-shot) → triage (feedback inmediato) → hitl (diseño de sistema) →
// adopcion (dinámico secuencial: 6 rondas con drift y eventos condicionales).
//
// Calibraciones sobre el documento de diseño (a propósito, documentadas):
// - Efectos de acción algo más generosos (piloto base 24, capacitación +8,
//   quick win +8/+5, herramienta +6, medición +4, champion +6) y drift −2:
//   con 12 jugadas sobre 120 personas, los efectos del diseño dejaban la
//   adopción alcanzable muy por debajo de sus propios normalizadores de score.
// - Normalizadores de A ajustados a la envolvente real (promedio/35, piso/20)
//   y curva de ROI anclada en la tesis del diseño: neto −5.000 con todo lo
//   demás bien ≈ score 80 («a seis meses se compra la curva, no el retorno»).
// - Gate del final «papel» por piso de área: < 10 (el diseño decía < 15, que
//   volvía «papel» incluso a sus propios caminos ganadores).
// - `ahorroMes = Σ adopcion × valorPunto` (sin el /100 del diseño, que
//   contradecía su propia calibración: comercial a adopción 50 → USD 3.500/mes).

import { roundRng } from '@/lib/sims/rng'
import { hashStr } from '@/lib/sims/rng'
import {
  ACCIONES,
  AREAS,
  CHECKLIST_TEXTS,
  CIERRE_DEBRIEF,
  DEBRIEF_ADOPCION,
  EVENTOS,
  FEED_ACCIONES,
  FINALES,
  INSIGHTS_PAUSA,
} from '@/lib/sims/data/adopcion'

// ─── Tipos ───

export type AreaId = 'comercial' | 'operaciones' | 'administracion' | 'planta'

export const AREA_IDS: AreaId[] = ['comercial', 'operaciones', 'administracion', 'planta']

export type ActionId =
  | 'piloto'
  | 'capacitacion'
  | 'quickwin'
  | 'champion'
  | 'sindicato'
  | 'pausa'
  | 'herramienta'
  | 'medicion'

/** Eventos sufridos por omisión, registrados como «acciones fantasma» para el debrief. */
export type GhostId = 'evento-rumor' | 'evento-recorte' | 'evento-incidente' | 'evento-error-publico'

export interface AreaState {
  adopcion: number // 0..100
  resistencia: number // 0..100
  capacitacion: 0 | 1 | 2
  champion: boolean
  pilotosExitosos: number
  quickWinDisponible: boolean // piloto exitoso aún no comunicado
}

export interface PlayedAction {
  action: ActionId | GhostId
  area?: AreaId
  ok: boolean // piloto fallido, quick win «humo», evento sufrido → false
  texto: string // línea narrada para el feed
  impacto: number // proxy de score movido (para el debrief)
  datos?: Record<string, string | number> // interpolación del debrief (resistencia, insight, variante…)
}

export interface MonthLog {
  month: number // 1..6
  actions: PlayedAction[]
  events: string[] // textos finales del mes
  moral: number
  adopcionPromedio: number
  roiVerificado: number // snapshot post-mes
}

export interface AdopcionState {
  seed: number
  attempt: number
  month: number // meses completados, 0..6
  budget: number
  mensualidad: number // USD que entran al inicio de los meses 2–6 (el directorio puede recortarla)
  gastado: number
  moral: number // 0..100, arranca en 55
  credibilidad: number // confianza del directorio, 0..100, arranca en 50
  roiEstimado: number
  roiVerificado: number
  areas: Record<AreaId, AreaState>
  flags: {
    sindicato: boolean
    sindicatoMes?: number
    herramienta: boolean
    herramientaMes?: number
    mediciones: number
    primeraMedicionMes?: number
    rumorDisparado: boolean // rumor del mes 2 a pleno
    rumorMitigado: boolean
    shadowIT: boolean // evento mes 3 disparado
    incidenteDatos: boolean // shadow IT no remediado → mes 5
    humo: boolean // comunicó un win inexistente
    winSinDatos: boolean // comunicó un win real pero sin medición previa
    pilotoHostil: boolean // piloto en área con resistencia ≥ 60 y capacitación 0
    pausas: number
  }
  history: MonthLog[]
  finished: boolean
  ending?: 'real' | 'papel' | 'rechazo'
  score?: number
}

export interface ActionChoice {
  action: ActionId
  area?: AreaId
}

// ─── Datos derivados ───

const areaDefById = new Map(AREAS.map((a) => [a.id, a]))
const accionById = new Map(ACCIONES.map((a) => [a.id, a]))

export const PERSONAS: Record<AreaId, number> = Object.fromEntries(
  AREAS.map((a) => [a.id, a.personas])
) as Record<AreaId, number>

const TOTAL_PERSONAS = AREAS.reduce((acc, a) => acc + a.personas, 0)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const clamp01 = (v: number) => clamp(v, 0, 1)

function fmtUsd(n: number): string {
  const abs = Math.abs(Math.round(n))
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${n < 0 ? '−' : ''}USD ${s}`
}

function tpl(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export function promedioPonderado(s: AdopcionState): number {
  return AREA_IDS.reduce((acc, id) => acc + s.areas[id].adopcion * PERSONAS[id], 0) / TOTAL_PERSONAS
}

export function peorArea(s: AdopcionState): number {
  return Math.min(...AREA_IDS.map((id) => s.areas[id].adopcion))
}

/** Ahorro mensual (USD) al nivel de adopción actual: Σ adopcion_a × valorPunto_a. */
export function ahorroMensual(s: AdopcionState): number {
  return AREA_IDS.reduce(
    (acc, id) => acc + s.areas[id].adopcion * (areaDefById.get(id)?.valorPunto ?? 0),
    0
  )
}

// ─── Estado inicial ───

export function initialState(seed: number, attempt: number): AdopcionState {
  const areas = Object.fromEntries(
    AREAS.map((a) => [
      a.id,
      {
        adopcion: a.adopcionInicial,
        resistencia: a.resistenciaInicial,
        capacitacion: 0,
        champion: false,
        pilotosExitosos: 0,
        quickWinDisponible: false,
      } satisfies AreaState,
    ])
  ) as Record<AreaId, AreaState>
  return {
    seed,
    attempt,
    month: 0,
    budget: 10_000,
    mensualidad: 8_000,
    gastado: 0,
    moral: 55,
    credibilidad: 50,
    roiEstimado: 0,
    roiVerificado: 0,
    areas,
    flags: {
      sindicato: false,
      herramienta: false,
      mediciones: 0,
      rumorDisparado: false,
      rumorMitigado: false,
      shadowIT: false,
      incidenteDatos: false,
      humo: false,
      winSinDatos: false,
      pilotoHostil: false,
      pausas: 0,
    },
    history: [],
    finished: false,
  }
}

export function seedFor(userId: string, attempt: number): number {
  return hashStr(`${userId}:adopcion:${attempt}`)
}

// ─── Validación (la UI muestra el motivo; el motor la exige) ───

export function validarElecciones(s: AdopcionState, elecciones: ActionChoice[]): string | null {
  if (s.finished) return 'La partida ya terminó.'
  if (elecciones.length > 2) return 'Hasta dos jugadas por mes: tu agenda de gerente no da para más.'
  const mensual = s.month + 1 >= 2 ? s.mensualidad : 0
  const disponible = s.budget + mensual
  let costo = 0
  const vistas = new Set<string>()
  for (const e of elecciones) {
    const def = accionById.get(e.action)
    if (!def) return 'Acción desconocida.'
    if (def.requiereArea && !e.area) return `«${def.nombre}» necesita un área.`
    const key = `${e.action}:${e.area ?? ''}`
    if (vistas.has(key)) return 'No podés repetir la misma jugada en el mismo mes.'
    vistas.add(key)
    costo += def.costo
    if (e.action === 'sindicato' && s.flags.sindicato) return 'Ya involucraste al sindicato.'
    if (e.action === 'herramienta' && s.flags.herramienta) return 'Ya compraste la herramienta corporativa.'
    if (e.action === 'capacitacion' && e.area && s.areas[e.area].capacitacion >= 2)
      return `${areaDefById.get(e.area)?.nombre} ya tiene la capacitación al máximo.`
    if (e.action === 'champion' && e.area) {
      const a = s.areas[e.area]
      if (a.champion) return `${areaDefById.get(e.area)?.nombre} ya tiene champion.`
      if (a.adopcion < 10 && a.capacitacion < 1) return 'Todavía no hay a quién nombrar.'
    }
  }
  if (costo > disponible) return 'Sin presupuesto: el costo total supera lo disponible.'
  return null
}

// ─── El mes ───

interface Ctx {
  s: AdopcionState
  mes: number
  rng: () => number
  acciones: PlayedAction[]
  eventos: string[]
}

/**
 * Resuelve un mes completo: cobro → acción 1 → acción 2 → evento → drift.
 * Función pura: devuelve un estado NUEVO. Al cerrar el mes 6, clasifica el
 * final y calcula el score. Lanza Error si las elecciones no son válidas.
 */
export function applyMonth(prev: AdopcionState, elecciones: ActionChoice[]): AdopcionState {
  const error = validarElecciones(prev, elecciones)
  if (error) throw new Error(error)

  const s: AdopcionState = structuredClone(prev)
  const mes = s.month + 1
  const rng = roundRng(s.seed, mes)
  const ctx: Ctx = { s, mes, rng, acciones: [], eventos: [] }

  // 1 · Cobrás presupuesto (la mensualidad entra desde el mes 2).
  if (mes >= 2) s.budget += s.mensualidad

  // 2 · Acciones, en el orden elegido.
  for (const e of elecciones) resolverAccion(ctx, e)

  // 3 · Evento del mes (calendario fijo con gates condicionales).
  resolverEvento(ctx)

  // 4 · Drift — la física del cambio cultural.
  resolverDrift(ctx, elecciones)

  s.month = mes
  s.history.push({
    month: mes,
    actions: ctx.acciones,
    events: ctx.eventos,
    moral: s.moral,
    adopcionPromedio: Math.round(promedioPonderado(s) * 10) / 10,
    roiVerificado: s.roiVerificado,
  })

  if (mes >= 6) return finish(s)
  return s
}

function gastar(s: AdopcionState, monto: number) {
  s.budget -= monto
  s.gastado += monto
}

function resolverAccion(ctx: Ctx, e: ActionChoice) {
  const { s, rng } = ctx
  const def = accionById.get(e.action)!
  gastar(s, def.costo)

  const antes = { adop: promedioPonderado(s), moral: s.moral, roi: s.roiVerificado }
  let bonusChecklist = 0
  const played: PlayedAction = { action: e.action, area: e.area, ok: true, texto: '', impacto: 0 }
  const areaDef = e.area ? areaDefById.get(e.area) : undefined
  const areaNombre = areaDef?.nombre ?? ''

  switch (e.action) {
    case 'piloto': {
      const a = s.areas[e.area!]
      const hostil = a.resistencia >= 60 && a.capacitacion === 0
      if (hostil) {
        s.flags.pilotoHostil = true
        bonusChecklist += 5 // quemó c2
      }
      played.datos = { resistencia: a.resistencia }
      const pExito = clamp(
        0.95 -
          a.resistencia / 100 +
          0.25 * a.capacitacion +
          0.15 * (a.champion ? 1 : 0) +
          0.1 * (s.flags.herramienta ? 1 : 0),
        0.05,
        0.95
      )
      const exito = rng() < pExito
      if (exito) {
        const ganancia = Math.round(
          24 *
            (1 - a.resistencia / 150) *
            (1 + 0.3 * a.capacitacion) *
            (1 + 0.3 * (a.champion ? 1 : 0)) *
            (s.flags.herramienta ? 1 : 0.6)
        )
        a.adopcion = clamp(a.adopcion + ganancia, 0, 100)
        a.resistencia = clamp(a.resistencia - 6, 0, 100)
        s.moral = clamp(s.moral + 3, 0, 100)
        a.quickWinDisponible = true
        a.pilotosExitosos += 1
        played.texto = tpl(FEED_ACCIONES['piloto-exito'], { area: areaNombre })
      } else {
        a.adopcion = clamp(a.adopcion + 2, 0, 100)
        a.resistencia = clamp(a.resistencia + 9, 0, 100)
        s.moral = clamp(s.moral - 6, 0, 100)
        played.ok = false
        played.texto = tpl(FEED_ACCIONES['piloto-fracaso'], { area: areaNombre })
      }
      break
    }
    case 'capacitacion': {
      const a = s.areas[e.area!]
      a.capacitacion = Math.min(2, a.capacitacion + 1) as 0 | 1 | 2
      a.resistencia = clamp(a.resistencia - 8, 0, 100)
      a.adopcion = clamp(a.adopcion + 8, 0, 100)
      s.moral = clamp(s.moral + 2, 0, 100)
      played.texto = tpl(FEED_ACCIONES['capacitacion'], { area: areaNombre })
      break
    }
    case 'quickwin': {
      const origen = AREA_IDS.find((id) => s.areas[id].quickWinDisponible)
      if (origen) {
        const nombreOrigen = areaDefById.get(origen)!.nombre
        s.areas[origen].quickWinDisponible = false
        played.area = origen
        if (s.flags.mediciones >= 1) {
          for (const id of AREA_IDS)
            s.areas[id].adopcion = clamp(s.areas[id].adopcion + (id === origen ? 8 : 5), 0, 100)
          s.moral = clamp(s.moral + 6, 0, 100)
          s.credibilidad = clamp(s.credibilidad + 10, 0, 100)
          played.datos = { variante: 'pleno' }
          played.texto = tpl(FEED_ACCIONES['quickwin-pleno'], { area: nombreOrigen })
        } else {
          for (const id of AREA_IDS)
            s.areas[id].adopcion = clamp(s.areas[id].adopcion + (id === origen ? 3 : 1), 0, 100)
          s.moral = clamp(s.moral + 2, 0, 100)
          s.credibilidad = clamp(s.credibilidad + 2, 0, 100)
          s.flags.winSinDatos = true
          bonusChecklist += 5 // quemó c3
          played.ok = false
          played.datos = { variante: 'sinDatos' }
          played.texto = tpl(FEED_ACCIONES['quickwin-sindatos'], { area: nombreOrigen })
        }
      } else {
        s.moral = clamp(s.moral - 8, 0, 100)
        s.credibilidad = clamp(s.credibilidad - 12, 0, 100)
        s.areas.planta.resistencia = clamp(s.areas.planta.resistencia + 5, 0, 100)
        s.areas.administracion.resistencia = clamp(s.areas.administracion.resistencia + 5, 0, 100)
        s.flags.humo = true
        bonusChecklist += 5 // quemó c3
        played.ok = false
        played.datos = { variante: 'humo' }
        played.texto = FEED_ACCIONES['quickwin-humo']
      }
      break
    }
    case 'champion': {
      const a = s.areas[e.area!]
      a.champion = true
      a.adopcion = clamp(a.adopcion + 6, 0, 100)
      played.texto = tpl(FEED_ACCIONES['champion'], {
        area: areaNombre,
        referente: areaDef?.referente ?? '',
      })
      break
    }
    case 'sindicato': {
      s.flags.sindicato = true
      s.flags.sindicatoMes = ctx.mes
      const tarde = s.flags.rumorDisparado
      const dPlanta = tarde ? 8 : 15
      const dAdmin = tarde ? 5 : 10
      s.areas.planta.resistencia = clamp(s.areas.planta.resistencia - dPlanta, 0, 100)
      s.areas.administracion.resistencia = clamp(s.areas.administracion.resistencia - dAdmin, 0, 100)
      s.moral = clamp(s.moral + 4, 0, 100)
      if (ctx.mes <= 2) bonusChecklist += 5 // activó c1
      played.ok = !tarde
      played.texto = FEED_ACCIONES[tarde ? 'sindicato-tarde' : 'sindicato-atiempo']
      break
    }
    case 'pausa': {
      s.moral = clamp(s.moral + 8, 0, 100)
      for (const id of AREA_IDS) s.areas[id].resistencia = clamp(s.areas[id].resistencia - 4, 0, 100)
      s.flags.pausas += 1
      const insight = INSIGHTS_PAUSA[ctx.mes] ?? INSIGHTS_PAUSA[6]
      played.datos = { insight }
      played.texto = tpl(FEED_ACCIONES['pausa'], { insight })
      break
    }
    case 'herramienta': {
      s.flags.herramienta = true
      s.flags.herramientaMes = ctx.mes
      s.areas.comercial.adopcion = clamp(s.areas.comercial.adopcion + 6, 0, 100)
      s.areas.administracion.adopcion = clamp(s.areas.administracion.adopcion + 6, 0, 100)
      bonusChecklist += 5 // encamina c5
      played.texto = FEED_ACCIONES['herramienta']
      break
    }
    case 'medicion': {
      s.flags.mediciones += 1
      if (!s.flags.primeraMedicionMes) s.flags.primeraMedicionMes = ctx.mes
      s.credibilidad = clamp(s.credibilidad + 8, 0, 100)
      s.areas.operaciones.adopcion = clamp(s.areas.operaciones.adopcion + 4, 0, 100)
      if (s.flags.primeraMedicionMes === ctx.mes && ctx.mes <= 4) bonusChecklist += 5 // activó c4
      played.texto = FEED_ACCIONES['medicion']
      break
    }
  }

  played.impacto =
    Math.abs(promedioPonderado(s) - antes.adop) * 0.5 +
    Math.abs(s.moral - antes.moral) * 0.4 +
    Math.abs(s.roiVerificado - antes.roi) / 1500 +
    bonusChecklist
  ctx.acciones.push(played)
}

function pickVariante(rng: () => number, key: string): string {
  const variantes = EVENTOS[key]
  const roll = rng()
  if (!variantes) return ''
  return variantes[roll < 0.5 ? 0 : 1]
}

function ghost(ctx: Ctx, action: GhostId, impacto: number, texto: string) {
  ctx.acciones.push({ action, ok: false, texto, impacto })
}

function resolverEvento(ctx: Ctx) {
  const { s, mes, rng } = ctx
  // Consumo en orden fijo: primero el jitter del mes, después la(s) variante(s)
  // de texto. Qué ramas corren depende solo de seed+decisiones → determinístico.
  const jitter = Math.floor(rng() * 5) - 2

  switch (mes) {
    case 1: {
      ctx.eventos.push(pickVariante(rng, 'm1-color'))
      break
    }
    case 2: {
      const m1 = s.history[0]
      const huboVisible = m1?.actions.some((a) => a.action === 'piloto' || a.action === 'herramienta')
      if (!huboVisible) {
        ctx.eventos.push(pickVariante(rng, 'm2-calma'))
      } else if (s.flags.sindicato || s.flags.pausas >= 1) {
        s.moral = clamp(s.moral - 4 + jitter, 0, 100)
        s.flags.rumorMitigado = true
        ctx.eventos.push(pickVariante(rng, 'm2-rumor-mitigado'))
      } else {
        s.moral = clamp(s.moral - 12 + jitter, 0, 100)
        s.areas.planta.resistencia = clamp(s.areas.planta.resistencia + 12, 0, 100)
        s.areas.administracion.resistencia = clamp(s.areas.administracion.resistencia + 8, 0, 100)
        s.flags.rumorDisparado = true
        const texto = pickVariante(rng, 'm2-rumor')
        ctx.eventos.push(texto)
        ghost(ctx, 'evento-rumor', 17, texto)
      }
      break
    }
    case 3: {
      if (s.flags.herramienta) {
        s.areas.comercial.adopcion = clamp(s.areas.comercial.adopcion + 4, 0, 100)
        ctx.eventos.push(pickVariante(rng, 'm3-licencias'))
      } else {
        s.areas.comercial.adopcion = clamp(s.areas.comercial.adopcion + 6, 0, 100)
        s.flags.shadowIT = true
        ctx.eventos.push(pickVariante(rng, 'm3-shadow'))
      }
      break
    }
    case 4: {
      if (s.flags.mediciones >= 1) {
        s.budget += 10_000
        s.credibilidad = clamp(s.credibilidad + 10, 0, 100)
        ctx.eventos.push(pickVariante(rng, 'm4-board-ok'))
      } else {
        s.mensualidad = 4_000
        s.credibilidad = clamp(s.credibilidad - 10, 0, 100)
        const texto = pickVariante(rng, 'm4-board-recorte')
        ctx.eventos.push(texto)
        ghost(ctx, 'evento-recorte', 17, texto)
      }
      break
    }
    case 5: {
      // Shadow IT nunca remediado → incidente de datos.
      if (s.flags.shadowIT && !s.flags.herramienta) {
        s.credibilidad = clamp(s.credibilidad - 15, 0, 100)
        s.moral = clamp(s.moral - 6 + jitter, 0, 100)
        s.flags.incidenteDatos = true
        const texto = pickVariante(rng, 'm5-incidente')
        ctx.eventos.push(texto)
        ghost(ctx, 'evento-incidente', 20, texto)
      }
      // El error público: piloto de cara al cliente sin red (capacitación o herramienta gobernada).
      const pilotoExpuesto = s.history
        .concat([{ month: mes, actions: ctx.acciones, events: [], moral: 0, adopcionPromedio: 0, roiVerificado: 0 }])
        .flatMap((m) => m.actions)
        .find(
          (a) =>
            a.action === 'piloto' && (a.area === 'comercial' || a.area === 'operaciones')
        )
      const areaExpuesta = pilotoExpuesto?.area
      if (
        areaExpuesta &&
        (s.areas[areaExpuesta].capacitacion === 0 || !s.flags.herramienta)
      ) {
        s.moral = clamp(s.moral - 8 + jitter, 0, 100)
        s.areas.comercial.adopcion = clamp(s.areas.comercial.adopcion - 8, 0, 100)
        for (const id of AREA_IDS) s.areas[id].resistencia = clamp(s.areas[id].resistencia + 6, 0, 100)
        const texto = pickVariante(rng, 'm5-error-publico')
        ctx.eventos.push(texto)
        ghost(ctx, 'evento-error-publico', 15, texto)
      } else {
        for (const id of AREA_IDS) s.areas[id].resistencia = clamp(s.areas[id].resistencia - 5, 0, 100)
        ctx.eventos.push(pickVariante(rng, 'm5-competidor'))
      }
      break
    }
    case 6: {
      if (s.areas.planta.champion) {
        s.areas.planta.adopcion = clamp(s.areas.planta.adopcion + 8, 0, 100)
        ctx.eventos.push(pickVariante(rng, 'm6-champion-planta'))
      } else {
        ctx.eventos.push(pickVariante(rng, 'm6-apagon'))
      }
      break
    }
  }
}

function resolverDrift(ctx: Ctx, elecciones: ActionChoice[]) {
  const { s, mes } = ctx
  const tocadas = new Set(elecciones.map((e) => e.area).filter(Boolean))
  // El quick win «toca» al área origen del win comunicado.
  for (const a of ctx.acciones) if (a.action === 'quickwin' && a.area) tocadas.add(a.area)
  const apagon = mes === 6 && !s.areas.planta.champion
  for (const id of AREA_IDS) {
    const a = s.areas[id]
    if (!tocadas.has(id) && !a.champion) {
      a.adopcion = clamp(a.adopcion - 2 * (apagon ? 2 : 1), 0, 100)
    }
  }
  // La moral regresa hacia 50 a razón de ±2 por mes.
  if (s.moral > 50) s.moral = Math.max(50, s.moral - 2)
  else if (s.moral < 50) s.moral = Math.min(50, s.moral + 2)
  // La moral mueve la resistencia de fondo.
  if (s.moral >= 60) for (const id of AREA_IDS) s.areas[id].resistencia = clamp(s.areas[id].resistencia - 2, 0, 100)
  else if (s.moral <= 35)
    for (const id of AREA_IDS) s.areas[id].resistencia = clamp(s.areas[id].resistencia + 3, 0, 100)
  // ROI: lo que no se mide no existe.
  const ahorro = ahorroMensual(s)
  s.roiEstimado += ahorro
  if (s.flags.mediciones >= 1) s.roiVerificado += ahorro
}

// ─── Final, score y checklist ───

export function huboPilotoHostilSinCapacitacion(s: AdopcionState): boolean {
  return s.flags.pilotoHostil
}

export interface ChecklistResult {
  id: 'c1' | 'c2' | 'c3' | 'c4' | 'c5'
  ok: boolean
  label: string
  texto: string
}

export function checklistOf(s: AdopcionState): ChecklistResult[] {
  const oks: Record<ChecklistResult['id'], boolean> = {
    c1: s.flags.sindicato && (s.flags.sindicatoMes ?? 9) <= 2, // legitimidad antes que velocidad
    c2: !huboPilotoHostilSinCapacitacion(s), // preparar antes de pilotear en terreno hostil
    c3: !s.flags.winSinDatos && !s.flags.humo, // nunca comunicar por delante de la evidencia
    c4: s.flags.mediciones >= 1 && (s.flags.primeraMedicionMes ?? 9) <= 4, // línea de base antes del directorio
    c5: s.flags.herramienta && !s.flags.incidenteDatos, // gobernar antes de que el shadow IT gobierne
  }
  return (['c1', 'c2', 'c3', 'c4', 'c5'] as const).map((id) => ({
    id,
    ok: oks[id],
    label: CHECKLIST_TEXTS[id].label,
    texto: oks[id] ? CHECKLIST_TEXTS[id].ok : CHECKLIST_TEXTS[id].fail,
  }))
}

export function scoreOf(s: AdopcionState): number {
  const promedio = promedioPonderado(s)
  const peor = peorArea(s)

  // A · Adopción (40): promedio ponderado por personas (25) + piso de la peor área (15)
  const ptsAdopcion = 25 * clamp01(promedio / 35) + 15 * clamp01(peor / 20)

  // B · Moral (15)
  const ptsMoral = 15 * clamp01((s.moral - 30) / 40)

  // C · ROI verificado neto (20) — el estimado NO puntúa: lo que no se mide no existe.
  // Anclas: neto −5.000 ≈ 12 pts (a seis meses se compra la curva, no el retorno).
  const neto = s.roiVerificado - s.gastado
  const ptsRoi =
    neto <= -30_000
      ? 0
      : neto <= -5_000
        ? 12 * ((neto + 30_000) / 25_000)
        : neto <= 0
          ? 12 + 3 * ((neto + 5_000) / 5_000)
          : 15 + 5 * clamp01(neto / 5_000)

  // D · Prácticas de dirección (25): checklist de 5 × 5 pts — LA CLAVE CURADA
  const ptsPracticas = checklistOf(s).filter((c) => c.ok).length * 5

  return Math.round(Math.min(100, ptsAdopcion + ptsMoral + ptsRoi + ptsPracticas))
}

export function desgloseScore(s: AdopcionState): { a: number; b: number; c: number; d: number } {
  const promedio = promedioPonderado(s)
  const peor = peorArea(s)
  const neto = s.roiVerificado - s.gastado
  const a = 25 * clamp01(promedio / 35) + 15 * clamp01(peor / 20)
  const b = 15 * clamp01((s.moral - 30) / 40)
  const c =
    neto <= -30_000
      ? 0
      : neto <= -5_000
        ? 12 * ((neto + 30_000) / 25_000)
        : neto <= 0
          ? 12 + 3 * ((neto + 5_000) / 5_000)
          : 15 + 5 * clamp01(neto / 5_000)
  const d = checklistOf(s).filter((x) => x.ok).length * 5
  return { a: Math.round(a), b: Math.round(b), c: Math.round(c), d }
}

/** Clasifica el final y sella la partida. Pura: devuelve un estado nuevo. */
export function finish(prev: AdopcionState): AdopcionState {
  const s: AdopcionState = structuredClone(prev)
  const promedio = promedioPonderado(s)
  const peor = peorArea(s)
  if (promedio < 22 || s.moral < 30) s.ending = 'rechazo'
  else if (s.flags.mediciones === 0 || s.moral < 48 || peor < 10) s.ending = 'papel'
  else s.ending = 'real'
  s.finished = true
  s.score = scoreOf(s)
  return s
}

// ─── Debrief · la clase ───

export interface AdopcionDebrief {
  final: { ending: 'real' | 'papel' | 'rechazo'; texto: string }
  top3: { titulo: string; texto: string; ok: boolean }[]
  checklist: ChecklistResult[]
  cierre: string
}

const GHOST_LABELS: Record<GhostId, string> = {
  'evento-rumor': 'El rumor que nadie desmintió',
  'evento-recorte': 'El directorio sin números',
  'evento-incidente': 'El incidente de datos',
  'evento-error-publico': 'El error público',
}

const ACTION_LABELS: Record<ActionId, string> = {
  piloto: 'Piloto',
  capacitacion: 'Capacitación',
  quickwin: 'Quick win',
  champion: 'Champion',
  sindicato: 'Sindicato y legales',
  pausa: 'Pausar y escuchar',
  herramienta: 'Herramienta corporativa',
  medicion: 'Medir y publicar',
}

function textoDebrief(s: AdopcionState, mes: number, a: PlayedAction): string {
  const areaNombre = a.area ? (areaDefById.get(a.area)?.nombre ?? '') : ''
  const vars: Record<string, string | number> = {
    area: areaNombre,
    m: mes,
    r: a.datos?.resistencia ?? '',
    insight: a.datos?.insight ?? '',
  }
  switch (a.action) {
    case 'piloto':
      return tpl(DEBRIEF_ADOPCION[a.ok ? 'piloto/acierto' : 'piloto/error'], vars)
    case 'capacitacion':
      return tpl(DEBRIEF_ADOPCION['capacitacion/acierto'], vars)
    case 'quickwin': {
      const variante = a.datos?.variante
      if (variante === 'humo') return tpl(DEBRIEF_ADOPCION['quickwin/humo'], vars)
      if (variante === 'sinDatos') return tpl(DEBRIEF_ADOPCION['quickwin/sinDatos'], vars)
      return tpl(DEBRIEF_ADOPCION['quickwin/acierto'], vars)
    }
    case 'champion':
      return tpl(DEBRIEF_ADOPCION['champion/acierto'], vars)
    case 'sindicato':
      return tpl(DEBRIEF_ADOPCION[a.ok ? 'sindicato/acierto' : 'sindicato/error'], vars)
    case 'pausa':
      return tpl(DEBRIEF_ADOPCION['pausa/acierto'], vars)
    case 'herramienta':
      return tpl(DEBRIEF_ADOPCION['herramienta/acierto'], vars)
    case 'medicion':
      return tpl(DEBRIEF_ADOPCION['medicion/acierto'], vars)
    case 'evento-rumor':
      return tpl(DEBRIEF_ADOPCION['sindicato/error'], vars)
    case 'evento-recorte':
      return tpl(DEBRIEF_ADOPCION['medicion/error'], vars)
    case 'evento-incidente':
      return tpl(DEBRIEF_ADOPCION['herramienta/error'], vars)
    case 'evento-error-publico':
      return tpl(DEBRIEF_ADOPCION['error-publico'], vars)
  }
}

/** Arma la clase final: las 3 decisiones que más movieron la aguja + checklist + cierre. */
export function debriefOf(s: AdopcionState): AdopcionDebrief {
  const jugadas: { mes: number; a: PlayedAction }[] = []
  for (const log of s.history) for (const a of log.actions) jugadas.push({ mes: log.month, a })
  const top3 = jugadas
    .slice()
    .sort((x, y) => Math.abs(y.a.impacto) - Math.abs(x.a.impacto))
    .slice(0, 3)
    .map(({ mes, a }) => ({
      titulo:
        a.action in GHOST_LABELS
          ? GHOST_LABELS[a.action as GhostId]
          : `${ACTION_LABELS[a.action as ActionId]}${a.area ? ` · ${areaDefById.get(a.area)?.nombre ?? ''}` : ''} · mes ${mes}`,
      texto: textoDebrief(s, mes, a),
      ok: a.ok,
    }))

  const ending = s.ending ?? 'papel'
  return {
    final: { ending, texto: tpl(FINALES[ending], { X: fmtUsd(s.roiVerificado) }) },
    top3,
    checklist: checklistOf(s),
    cierre: tpl(CIERRE_DEBRIEF, { X: fmtUsd(s.roiVerificado), Y: fmtUsd(s.gastado) }),
  }
}
