// Simulador «Checkpoint» (hitl) — Bloque 05 · Agents & Systems.
// Motor puro determinístico, patrón lib/sim/engine.ts: sin store, sin Date.now,
// sin Math.random. Cada outcome es una regla determinística sobre los atributos
// del caso; el único azar es el ORDEN de presentación de la tabla, barajado con
// rngFor(userId, 'hitl', String(intento)). Dos alumnos con el mismo diseño ven
// exactamente los mismos resultados — comparable en el aula, que es el punto.
//
// Dificultad dentro del arco de sims del programa (declarada, no accidental):
// cotizacion (single-shot, 10 decisiones) → triage (12 casos, feedback
// inmediato) → hitl (diseño de sistema: 6 modos + 3 umbrales, SIN feedback
// intermedio) → adopcion (dinámico secuencial, 6 rondas con drift).
//
// Calibraciones sobre el documento de diseño (documentadas a propósito):
// - La meseta de autonomía se corre a 0.35–0.75: con 20 casos y los umbrales
//   sanos, un diseño maduro escala ~half de los casos — la meseta 0.65–0.90 del
//   diseño era inalcanzable con su propia matriz de escalamientos.
// - h20 (carta documento) cuesta $180.000 (no $350.000): el contenido es
//   trivial; el canal, no. h07 (art. 10 bis + daño punitivo) conserva los
//   $350.000. Así la clave curada queda en banda alta con su único punto ciego
//   (h20) doliendo sin hundirla — «siempre hay una frontera que se puede
//   correr un caso más».
// - El freno del borrador legal cuenta ojos humanos en P1, P4 o P5 (el diseño
//   decía P4/P5): un clasificador humano deriva el caso a legales igual que un
//   resolutor humano.

import { rngFor } from '@/lib/sims/rng'
import { CASOS_HITL, DEBRIEF_HITL, MODO_LABELS, PASO_LABELS } from '@/lib/sims/data/hitl'

// ─── Tipos ───

export type PasoId =
  | 'clasificacion' // 1. Recepción y clasificación
  | 'verificacion' // 2. Verificación de identidad y datos
  | 'diagnostico' // 3. Diagnóstico del reclamo
  | 'resolucion' // 4. Resolución y compensación
  | 'respuesta' // 5. Respuesta al cliente
  | 'cierre' // 6. Cierre y registro

export const PASOS: PasoId[] = [
  'clasificacion',
  'verificacion',
  'diagnostico',
  'resolucion',
  'respuesta',
  'cierre',
]

export type Modo = 'regla' | 'ia' | 'humano'

/** Sentinel serializable: Infinity no sobrevive JSON.stringify. */
export const SIN_LIMITE = 999_999_999

export type MontoMax = 25_000 | 75_000 | 200_000 | typeof SIN_LIMITE
export type ConfianzaMin = 0.5 | 0.7 | 0.9

export interface HitlDesign {
  pasos: Record<PasoId, Modo>
  montoMax: MontoMax // ARS: tope que la IA/regla resuelve sola en P4
  confianzaMin: ConfianzaMin // clasificación IA por debajo → humano
  enojadoAHumano: boolean // tono enojado/furioso → humano responde en P5
}

export type Outcome = 'ok' | 'leve' | 'grave' | 'abandono'

export interface StepResult {
  paso: PasoId
  modo: Modo // modo diseñado
  ejecutor: Modo // quién lo ejecutó de verdad (escalamientos: 'humano')
  escalado: boolean // true si un umbral derivó a humano
  outcome: Outcome
  costoGestion: number // ARS de operar este paso
  costoError: number // ARS del error (0 si ok)
  deltaRep: number // impacto en reputación (≤ 0 salvo saves puntuales)
  nota: string // una frase: qué pasó acá (alimenta la tabla)
}

export interface CaseResult {
  caseId: string
  resultado: Outcome // el peor outcome de sus pasos
  pasos: StepResult[]
  costoGestion: number
  costoErrores: number
  deltaRep: number
  tocoHumano: boolean
}

export interface HitlMetrics {
  costoTotal: number // gestión + errores
  costoGestion: number
  costoErrores: number
  reputacion: number // 0..100, arranca en 100
  autonomia: number // 0..1 — % de casos resueltos sin tocar un humano
  erroresGraves: number
  erroresLeves: number
  abandonos: number
}

export type HitlPhase = 'diseno' | 'resultados'

export interface HitlState {
  phase: HitlPhase
  intento: number // 1, 2, 3… (sesiones previas del store + 1)
  orden: string[] // ids de casos barajados
  design?: HitlDesign // se congela al correr
  resultados?: CaseResult[]
  metricas?: HitlMetrics
}

export interface CasoReclamo {
  id: string // 'h01'…'h20'
  cliente: string
  canal: 'app' | 'telefono' | 'email' | 'redes' | 'carta-documento'
  titulo: string
  texto: string // el reclamo en voz del cliente
  montoPedido: number // ARS que el cliente reclama
  montoJusto: number // ARS de la compensación correcta (clave curada)
  confianza: number // 0..1 — confianza de clasificación del modelo (fija, autoral)
  tono: 'neutral' | 'enojado' | 'furioso'
  datosCompletos: boolean // false → la verificación por regla rebota
  vip: boolean
  fraude: false | 'injection' | 'documental'
  legal: boolean // invoca Ley 24.240 / carta documento
  multicausa: boolean // varios problemas mezclados en un reclamo
}

// ─── Costos unitarios por intervención (caso × paso) ───

export const COSTO_POR_MODO: Record<Modo, number> = { humano: 4_000, ia: 180, regla: 15 }

export const COSTO_PISO = 60_000 // ≈ costo total de un diseño de referencia
export const COSTO_TECHO = 900_000 // ≈ full-IA sin límites con todos los errores

const PEOR: Record<Outcome, number> = { ok: 0, leve: 1, abandono: 2, grave: 3 }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

// ─── Motor ───

interface CaseFlags {
  contaminado: boolean // h05 leído por IA en P1
  fraudeNoDetectado: boolean // h15 pasó verificación no humana
  fraudeDetectado: boolean // un humano cazó el comprobante / neutralizó el injection
  misclasificado: boolean // P1 regla erró la etiqueta
  abandonado: boolean
}

function correrCaso(caso: CasoReclamo, d: HitlDesign): CaseResult {
  const pasos: StepResult[] = []
  const f: CaseFlags = {
    contaminado: false,
    fraudeNoDetectado: false,
    fraudeDetectado: false,
    misclasificado: false,
    abandonado: false,
  }

  // Ejecutores previsibles (los umbrales son deterministas sobre el caso):
  const p1Escala = d.pasos.clasificacion === 'ia' && caso.confianza < d.confianzaMin
  const p1Ejecutor: Modo = p1Escala ? 'humano' : d.pasos.clasificacion
  const p4Escala = d.pasos.resolucion !== 'humano' && caso.montoPedido > d.montoMax
  const p4Ejecutor: Modo = p4Escala ? 'humano' : d.pasos.resolucion
  const p5Escala =
    d.pasos.respuesta !== 'humano' && d.enojadoAHumano && caso.tono !== 'neutral'
  const p5Ejecutor: Modo = p5Escala ? 'humano' : d.pasos.respuesta
  // Freno del borrador legal: ojos humanos en P1, P3, P4 o P5.
  const ojosHumanos =
    p1Ejecutor === 'humano' ||
    d.pasos.diagnostico === 'humano' ||
    p4Ejecutor === 'humano' ||
    p5Ejecutor === 'humano'

  const push = (r: StepResult) => pasos.push(r)
  function base(paso: PasoId, modo: Modo, ejecutor: Modo, escalado: boolean): StepResult {
    return {
      paso,
      modo,
      ejecutor,
      escalado,
      outcome: 'ok',
      costoGestion: COSTO_POR_MODO[ejecutor],
      costoError: 0,
      deltaRep: 0,
      nota: '',
    }
  }

  // ── P1 · Clasificación ──
  {
    const r = base('clasificacion', d.pasos.clasificacion, p1Ejecutor, p1Escala)
    if (p1Ejecutor === 'regla') {
      if (caso.confianza >= 0.8 && !caso.multicausa) {
        r.nota = 'Las keywords alcanzaron: el reclamo venía claro.'
      } else {
        r.outcome = 'leve'
        r.costoError = 6_000
        r.deltaRep = -2
        f.misclasificado = true
        r.nota = 'La regla lo mandó al bucket equivocado: retrabajo y un cliente rebotado.'
      }
    } else if (p1Ejecutor === 'ia') {
      r.nota = 'El modelo clasificó bien el texto libre.'
      if (caso.fraude === 'injection') {
        f.contaminado = true
        r.nota = 'El modelo clasificó el reclamo — y leyó las instrucciones que venían adentro.'
      }
    } else {
      r.nota = p1Escala
        ? `Confianza ${caso.confianza.toFixed(2)} bajo el umbral: lo etiquetó una persona.`
        : 'Etiquetado a mano, sin sorpresas.'
    }
    push(r)
  }

  // ── P2 · Verificación ──
  {
    const modo = d.pasos.verificacion
    const r = base('verificacion', modo, modo, false)
    if (modo === 'regla') {
      if (!caso.datosCompletos) {
        if (caso.id === 'h06') {
          r.outcome = 'abandono'
          r.costoError = 150_000
          r.deltaRep = -6
          f.abandonado = true
          r.nota = 'El formulario exigía un dato que ella no podía tener: abandonó tras 9 años de clienta.'
        } else {
          r.outcome = 'leve'
          r.costoError = 6_000
          r.deltaRep = -2
          r.nota = 'Rebote automático: el cliente insistió por otro canal y pagaste el retrabajo.'
        }
      } else {
        r.nota = 'Datos completos: la regla verificó sin fricción.'
        if (caso.fraude === 'documental') {
          f.fraudeNoDetectado = true
          r.nota = 'El formulario cerraba perfecto — la regla no hace peritaje de PDFs.'
        }
      }
    } else if (modo === 'ia') {
      r.nota = 'Verificación flexible: validó por vías alternativas.'
      if (caso.fraude === 'documental') {
        f.fraudeNoDetectado = true
        r.nota = 'La IA validó coherencia, no autenticidad: el comprobante adulterado pasó.'
      }
    } else {
      r.nota = 'Identidad y documentos cotejados a mano.'
      if (caso.fraude === 'documental') {
        f.fraudeDetectado = true
        r.nota = 'El humano cotejó contra el extracto: la transferencia real era de $15.800 — comprobante adulterado.'
      }
    }
    if (f.abandonado) {
      push(r)
      // El caso se cerró: los pasos restantes no operan.
      for (const paso of PASOS.slice(pasos.length)) {
        push({
          paso,
          modo: d.pasos[paso],
          ejecutor: d.pasos[paso],
          escalado: false,
          outcome: 'ok',
          costoGestion: 0,
          costoError: 0,
          deltaRep: 0,
          nota: '— (la clienta ya había abandonado el reclamo)',
        })
      }
      return cerrarCaso(caso, pasos)
    }
    push(r)
  }

  // ── P3 · Diagnóstico ──
  {
    const modo = d.pasos.diagnostico
    const r = base('diagnostico', modo, modo, false)
    if (modo === 'humano') {
      r.nota = 'Diagnóstico profesional, con contexto completo.'
      if (caso.fraude === 'documental') {
        f.fraudeDetectado = true
        r.nota = 'El profesional pidió el extracto: el comprobante no cerraba — fraude documental.'
      }
      if (caso.fraude === 'injection') {
        f.fraudeDetectado = true
        r.nota = 'El analista leyó el «modo prueba interna» y lo marcó como intento de manipulación.'
      }
    } else {
      // Premisa heredada de una clasificación errada.
      if (f.misclasificado) {
        r.outcome = 'leve'
        r.costoError += 8_000
        r.nota = 'Diagnóstico sobre una etiqueta errada: hubo que recontactar al cliente.'
      }
      if (modo === 'regla') {
        if (caso.legal || caso.multicausa) {
          r.outcome = 'leve'
          r.costoError += 8_000
          r.nota = 'El árbol de decisión no lee contexto: diagnóstico pobre y recontacto.'
        } else if (!r.nota) {
          r.nota = 'Caso tabulado: el árbol lo resolvió bien.'
        }
      } else {
        // IA
        if (caso.legal) {
          if (ojosHumanos) {
            r.outcome = 'leve'
            r.costoError += 8_000
            r.nota = 'El borrador reconocía responsabilidad por escrito; un humano del flujo lo frenó a tiempo.'
          } else {
            r.outcome = 'grave'
            const monto = caso.id === 'h20' ? 180_000 : 350_000
            r.costoError += monto
            r.deltaRep += caso.id === 'h20' ? -8 : -10
            r.nota = `La IA reconoció responsabilidad por escrito y nadie lo frenó: ${fmt(monto)} de provisión legal.`
          }
        } else if (!r.nota) {
          r.nota = 'Diagnóstico correcto a $180.'
        }
      }
    }
    push(r)
  }

  // ── P4 · Resolución y compensación ──
  {
    const r = base('resolucion', d.pasos.resolucion, p4Ejecutor, p4Escala)
    if (p4Ejecutor === 'humano') {
      if (caso.fraude) {
        f.fraudeDetectado = true
        r.nota =
          caso.fraude === 'injection'
            ? 'El resolutor miró el caso: no había corte registrado — pedido rechazado.'
            : 'El resolutor cotejó contra el extracto: devolución denegada, fraude documental.'
      } else if (caso.id === 'h11') {
        r.nota = 'El humano encontró la política intermedia: reposición al 50% por evento climático.'
      } else {
        r.nota = p4Escala
          ? `${fmt(caso.montoPedido)} superaba el tope: lo resolvió una persona, pagó ${fmt(caso.montoJusto)}.`
          : `Resolución humana: pagó lo justo (${fmt(caso.montoJusto)}).`
      }
    } else if (p4Ejecutor === 'ia') {
      if (caso.id === 'h05' && f.contaminado) {
        r.outcome = 'grave'
        r.costoError = 250_000
        r.deltaRep = -6
        r.nota = 'El contexto venía contaminado y la IA tenía autoridad: acreditó $250.000 a un estafador.'
      } else if (caso.id === 'h15' && f.fraudeNoDetectado && !f.fraudeDetectado) {
        r.outcome = 'grave'
        r.costoError = 158_000
        r.deltaRep = -6
        r.nota = 'Nadie peritó el comprobante y el monto entraba en el tope: pagó $158.000 contra un PDF editado.'
      } else {
        r.nota = `La IA pagó lo justo (${fmt(caso.montoJusto)}), no lo pedido.`
        if (caso.vip && p5Ejecutor !== 'humano') {
          r.outcome = 'leve'
          r.deltaRep = -4
          r.nota = 'Resolución correcta en plata, errada en forma: a un VIP la política estándar le suena a destrato.'
        }
      }
    } else {
      // regla
      if (caso.id === 'h15' && f.fraudeNoDetectado && !f.fraudeDetectado) {
        r.outcome = 'grave'
        r.costoError = 158_000
        r.deltaRep = -6
        r.nota = 'La tabla procesó la devolución contra el comprobante adjunto: $158.000 a un PDF editado.'
      } else if (caso.fraude === 'injection') {
        r.nota = 'La tabla no encontró corte registrado en la zona: pagó $0. Las reglas no leen instrucciones.'
      } else if (caso.montoJusto !== caso.montoPedido) {
        r.outcome = 'leve'
        r.costoError = Math.abs(caso.montoPedido - caso.montoJusto)
        if (caso.montoPedido < caso.montoJusto && caso.tono !== 'neutral') r.deltaRep = -2
        r.nota = `Tabla plana: pagó ${fmt(caso.montoPedido)} donde correspondían ${fmt(caso.montoJusto)}.`
      } else {
        r.nota = `La tabla coincidía con lo justo: pagó ${fmt(caso.montoJusto)}.`
        if (caso.vip && p5Ejecutor !== 'humano') {
          r.outcome = 'leve'
          r.deltaRep = -4
          r.nota = 'Compensación correcta con trato de manual: al VIP le dolió la forma, no la plata.'
        }
      }
    }
    push(r)
  }

  // ── P5 · Respuesta al cliente ──
  {
    const r = base('respuesta', d.pasos.respuesta, p5Ejecutor, p5Escala)
    if (p5Ejecutor === 'humano') {
      r.nota = p5Escala
        ? 'El tono disparó la derivación: llamó una persona.'
        : 'Respuesta firmada por una persona.'
      if (caso.tono === 'furioso') {
        r.deltaRep = 2
        r.nota = 'El llamado a tiempo desactivó la crisis: el cliente más difícil del lunes terminó agradeciendo.'
      }
    } else if (p5Ejecutor === 'regla') {
      let rep = 0
      let nota = 'Plantilla estándar enviada.'
      if (caso.tono === 'furioso') {
        rep -= 8
        r.outcome = 'leve'
        nota = 'La plantilla a un furioso: lo posteó en redes.'
        if (caso.id === 'h03') {
          r.costoError = 25_000
          nota = '«Estimado cliente, su reclamo fue procesado» a seis días sin servicio: escaló a redes, gestión de crisis.'
        }
      } else if (caso.tono === 'enojado') {
        rep -= 4
        r.outcome = 'leve'
        nota = 'Respuesta enlatada a un cliente enojado: la relación quedó peor que el reclamo.'
      }
      if (caso.vip) {
        rep -= 4
        r.outcome = 'leve'
        nota = 'Un VIP esperaba a un responsable y recibió una plantilla.'
      }
      if (caso.canal === 'redes' && caso.tono !== 'neutral') {
        rep -= 2
        nota += ' Y fue en público.'
      }
      r.deltaRep = rep
      r.nota = nota
    } else {
      // IA
      if (caso.tono === 'furioso') {
        r.outcome = 'leve'
        r.deltaRep = -5
        r.costoError = 6_000
        r.nota = 'Texto impecable, cliente equivocado: al furioso no le faltaba redacción, le faltaba una persona.'
      } else if (caso.id === 'h04') {
        r.outcome = 'leve'
        r.deltaRep = -3
        r.nota = 'La respuesta era empática y correcta — pero Kaplan esperaba un ejecutivo, no un ticket bien escrito.'
      } else {
        r.nota = 'Respuesta empática y específica, a centavos.'
      }
    }
    push(r)
  }

  // ── P6 · Cierre y registro ──
  {
    const modo = d.pasos.cierre
    const r = base('cierre', modo, modo, false)
    if (modo === 'regla') {
      r.nota = 'Registro determinístico: la regla ES la respuesta correcta acá.'
    } else if (modo === 'ia') {
      if (caso.multicausa) {
        r.outcome = 'leve'
        r.costoError = 3_000
        r.nota = 'El modelo etiquetó mal el caso multicausa: ruido en la analítica futura.'
      } else {
        r.nota = 'Cierre correcto — para una tarea que no tenía ambigüedad.'
      }
    } else {
      r.nota = 'Una persona tipeó el cierre de un caso ya resuelto.'
    }
    push(r)
  }

  return cerrarCaso(caso, pasos)
}

function cerrarCaso(caso: CasoReclamo, pasos: StepResult[]): CaseResult {
  let resultado: Outcome = 'ok'
  for (const p of pasos) if (PEOR[p.outcome] > PEOR[resultado]) resultado = p.outcome
  return {
    caseId: caso.id,
    resultado,
    pasos,
    costoGestion: pasos.reduce((a, p) => a + p.costoGestion, 0),
    costoErrores: pasos.reduce((a, p) => a + p.costoError, 0),
    deltaRep: pasos.reduce((a, p) => a + p.deltaRep, 0),
    tocoHumano: pasos.some((p) => p.ejecutor === 'humano' && p.costoGestion > 0),
  }
}

/** Corre los 20 casos del lunes contra un diseño. Función pura, sin RNG. */
export function correr(design: HitlDesign): {
  resultados: CaseResult[]
  metricas: HitlMetrics
  score: number
} {
  const resultados = CASOS_HITL.map((c) => correrCaso(c, design))
  const costoGestion = resultados.reduce((a, r) => a + r.costoGestion, 0)
  const costoErrores = resultados.reduce((a, r) => a + r.costoErrores, 0)
  const deltaRep = resultados.reduce((a, r) => a + r.deltaRep, 0)
  const metricas: HitlMetrics = {
    costoGestion,
    costoErrores,
    costoTotal: costoGestion + costoErrores,
    reputacion: Math.min(100, Math.max(0, 100 + deltaRep)),
    autonomia: resultados.filter((r) => !r.tocoHumano).length / resultados.length,
    erroresGraves: resultados.filter((r) => r.resultado === 'grave').length,
    erroresLeves: resultados.filter((r) => r.resultado === 'leve').length,
    abandonos: resultados.filter((r) => r.resultado === 'abandono').length,
  }
  return { resultados, metricas, score: scoreHitl(metricas) }
}

/** Score 0..100 — 35 eficiencia · 25 graves · 20 reputación · 20 autonomía con criterio. */
export function scoreHitl(m: HitlMetrics): number {
  // 35 pts — eficiencia económica (gestión + errores, una sola vara)
  const costo = 35 * clamp01((COSTO_TECHO - m.costoTotal) / (COSTO_TECHO - COSTO_PISO))

  // 25 pts — errores graves (fraude pagado, exposición legal)
  const graves = 25 * Math.max(0, 1 - m.erroresGraves / 4)

  // 20 pts — reputación final
  const rep = 20 * (m.reputacion / 100)

  // 20 pts — autonomía CON CRITERIO: ni miedo ni imprudencia (meseta 0.35–0.75)
  const a = m.autonomia
  const auto =
    a < 0.15
      ? (a / 0.15) * 0.4
      : a < 0.35
        ? 0.4 + ((a - 0.15) / 0.2) * 0.6
        : a <= 0.75
          ? 1
          : 1 - ((a - 0.75) / 0.25) * 0.5 // >75% sin humano = aceptaste riesgos

  return Math.round(costo + graves + rep + 20 * auto)
}

// ─── Sesión ───

/** Orden de presentación barajado — el único azar del simulador. */
export function barajarOrden(userId: string, intento: number): string[] {
  const rng = rngFor(userId, 'hitl', String(intento))
  const ids = CASOS_HITL.map((c) => c.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

export function nuevoEstado(userId: string, intento: number): HitlState {
  return { phase: 'diseno', intento, orden: barajarOrden(userId, intento) }
}

export const casoById = new Map(CASOS_HITL.map((c) => [c.id, c]))

// ─── Debrief ───

export interface HitlDebrief {
  veredicto: string
  pasos: { paso: PasoId; label: string; modo: Modo; modoLabel: string; texto: string }[]
  umbrales: { clave: string; texto: string }[]
  momentos: { caseId: string; titulo: string; texto: string }[]
}

/** Arma la clase completa: veredicto por banda, feedback por paso y umbral, momentos críticos. */
export function debriefHitl(
  design: HitlDesign,
  resultados: CaseResult[],
  score: number
): HitlDebrief {
  const porCaso = new Map(resultados.map((r) => [r.caseId, r]))
  const veredicto =
    DEBRIEF_HITL.veredictos.find((v) => score >= v.min)?.texto ??
    DEBRIEF_HITL.veredictos[DEBRIEF_HITL.veredictos.length - 1].texto

  const pasos = PASOS.map((paso) => ({
    paso,
    label: PASO_LABELS[paso],
    modo: design.pasos[paso],
    modoLabel: MODO_LABELS[design.pasos[paso]],
    texto: DEBRIEF_HITL.porPaso[paso][design.pasos[paso]],
  }))

  const montoKey =
    design.montoMax === SIN_LIMITE ? 'sin-limite' : (String(design.montoMax) as '25000')
  const umbrales = [
    { clave: `Tope de monto: ${design.montoMax === SIN_LIMITE ? 'sin límite' : fmt(design.montoMax)}`, texto: DEBRIEF_HITL.montoMax[montoKey] },
    {
      clave: `Confianza mínima: ${design.confianzaMin}`,
      texto: DEBRIEF_HITL.confianzaMin[String(design.confianzaMin) as '0.5'],
    },
    {
      clave: `Enojado → humano: ${design.enojadoAHumano ? 'activado' : 'desactivado'}`,
      texto: DEBRIEF_HITL.enojadoAHumano[design.enojadoAHumano ? 'on' : 'off'],
    },
  ]

  const momentos: HitlDebrief['momentos'] = []
  const addMomento = (caseId: string, variante: string) => {
    const m = DEBRIEF_HITL.momentos[caseId]
    const texto = m?.variantes[variante]
    if (m && texto) momentos.push({ caseId, titulo: m.titulo, texto })
  }

  const h05 = porCaso.get('h05')
  if (h05) {
    const leidoPorIA = h05.pasos[0].ejecutor === 'ia'
    if (h05.resultado === 'grave') addMomento('h05', 'pagado')
    else if (leidoPorIA) addMomento('h05', 'frenado')
    // si una regla o un humano lo leyó en P1, no hubo momento: se omite.
  }
  const h15 = porCaso.get('h15')
  if (h15) addMomento('h15', h15.resultado === 'grave' ? 'pagado' : 'frenado')
  const h06 = porCaso.get('h06')
  if (h06) addMomento('h06', h06.resultado === 'abandono' ? 'perdida' : 'resuelta')
  const h03 = porCaso.get('h03')
  if (h03) addMomento('h03', h03.pasos[4].ejecutor === 'humano' ? 'contenido' : 'exploto')
  const h20 = porCaso.get('h20')
  if (h20) {
    addMomento('h20', h20.resultado === 'grave' ? 'automatica' : 'escalada')
  }

  return { veredicto, pasos, umbrales, momentos }
}

/** Diseño de referencia del debrief («la clave curada»). */
export const DISENO_REFERENCIA: HitlDesign = {
  pasos: {
    clasificacion: 'ia',
    verificacion: 'ia',
    diagnostico: 'ia',
    resolucion: 'ia',
    respuesta: 'ia',
    cierre: 'regla',
  },
  montoMax: 75_000,
  confianzaMin: 0.7,
  enojadoAHumano: true,
}
