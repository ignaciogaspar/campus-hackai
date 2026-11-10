// Biblioteca de diagramas SVG para los decks keynote (AI-Centric Management).
//
// Componentes React puros (sin estado, sin efectos). Se referencian desde el
// markdown de un deck con la directiva `:::diagram <id>` (ver
// components/campus/SlideDeck.tsx). Un id inexistente degrada a slide default:
// el deck nunca se rompe.
//
// MARCA. Los quince diagramas están dibujados para la marca institucional del
// IAE Business School tal como está resuelta en el sitio del programa
// (app/globals.css + components/Masthead.tsx): blanco de papel, azul IAE
// #1d21a9, tinta #10142c, gris #6c6c6c, borde #e4e7f0 y azul claro #eef0fb.
// La tipografía la heredan de la página, que es Montserrat en todo el sitio.
// Los rótulos de registro usan la versalita espaciada del masthead y de las
// pestañas de navegación (mayúsculas, letter-spacing, peso 600, azul).
//
// Ninguno de los quince depende ya de app/campus.css: cada uno declara color,
// grosor y tamaño en atributos propios, así que no se rompen si los tokens del
// deck cambian ni si la slide cambia de fondo. Lo único que toman del CSS es el
// tamaño del <svg> (`.c-slide-diagram svg`).
//
// PALETA Y SEMÁNTICA (única para los quince, ver Caja más abajo):
//   azul pleno .......... lo que agrega valor, lo que se destaca
//   azul claro + borde .. lo mismo, cuando la caja tiene que llevar texto largo
//   blanco + borde gris . neutro, una pieza más del sistema
//   borde de tinta ...... la persona, la decisión, el eje estructural
//   contorno punteado ... lo no comprobado, lo que no viene garantizado
//   tramado ............. la pérdida: lo que se paga o se pierde y no se mide
// UN SOLO AZUL DE RELLENO (#1d21a9). El segundo azul que había —#14178a, que
// además no salía de app/globals.css— no se distinguía del de marca a tamaño
// de proyección: dos cajas contiguas leían como el mismo azul mal calibrado y
// no como dos significados. Lo que era «la persona» pasó a la FORMA.
// Son dos recursos distintos y no se superponen: el punteado no lleva relleno y
// el tramado lleva contorno sólido, para que la trama sea lo que se ve.
// La tinta plena quedó reservada al TRAZO —eje, contorno, punta de flecha— y no
// se usa nunca para rellenar una caja: sobre la slide blanca esas masas leían
// como tarjetas del tema oscuro anterior.
//
// FORMA. Rectangular, sin radio, igual que los paneles de la slide: docs/iae-brand.md
// registra los controles del sitio del IAE como «rectangular shape» y la piel
// del deck sacó todos los border-radius. Panel y Caja dibujan esquinas vivas.
//
// DOS TONOS PARA EL RÓTULO DE REGISTRO (componente R): azul de marca el lado
// que agrega valor, el eje y sus extremos; gris el lado neutro o el dato
// secundario que cuelga del eje. Tinta, nunca.
// El carmesí #c8102e quedó afuera: docs/iae-brand.md deja asentado que no se
// observó como acento del sitio del IAE y no se lleva a esta marca. Donde antes
// había rojo ahora hay tramado, contorno punteado o tinta profunda.
//
// GEOMETRÍA. Todos los diagramas dibujan sobre un panel de 1120 unidades de
// ancho y como máximo 360 de alto: con eso la escala de proyección dentro del
// marco de 1280x720 es ~1:1. Los rótulos arrancan en 20 unidades (ver T y R):
// con la escala real medida en las slides más cargadas (~0,90) eso proyecta 18
// px, y en una slide con aire, 21-22.

import type { ComponentType, ReactNode } from 'react'

/* ============================================================
   TOKENS Y PRIMITIVAS
   ============================================================ */

const TINTA = '#10142c'
const AZUL = '#1d21a9'
// Un solo gris en la slide. #6c6c6c es el --muted de app/globals.css, pero la
// piel del deck se quedó con el --c-muted del campus (#5f6474, ~6:1 sobre
// blanco): con los dos vivos, el copete de la slide y los rótulos del SVG
// salían en dos grises distintos y el más flojo de los dos era el de adentro
// del gráfico. Un valor, una procedencia.
const GRIS = '#5f6474'
const BORDE = '#e4e7f0'
const AZUL_CLARO = '#eef0fb'
const BLANCO = '#ffffff'

/** Grosores: uno por rol, iguales en los quince diagramas. */
const G_CAJA = 2.5
const G_EJE = 3
const G_FLECHA = 4
const G_CURVA = 5.5

const RAYA = '9 6'
const TRAMA_ID = 'dg-trama'
const TRAMA = `url(#${TRAMA_ID})`

/** Tramado a 45°: marca pérdida o riesgo sin recurrir a un color de alerta. */
function Trama() {
  return (
    <defs>
      <pattern id={TRAMA_ID} width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width={9} height={9} fill={BLANCO} />
        <line x1={0} y1={0} x2={0} y2={9} stroke={TINTA} strokeWidth={2.4} strokeOpacity={0.4} />
      </pattern>
    </defs>
  )
}

/**
 * Panel institucional: el diagrama siempre se para sobre blanco de papel, así
 * la decisión de contraste vale aunque la slide traiga un fondo teñido.
 */
function Panel({ label, viewBox, children }: { label: string; viewBox: string; children: ReactNode }) {
  const [, , ancho, alto] = viewBox.split(' ').map(Number)
  return (
    /* `xMinYMid`: el <svg> se escala por el alto que la slide le deja, así que
       con el centrado por defecto el borde izquierdo del dibujo se corría de
       slide en slide —medido en J1: x=78, 80, 104, 120, 134— mientras marca,
       título, kicker y pie arrancan siempre en 48. Anclado a la izquierda hay
       un solo margen para todo lo que hay en la slide, sea cual sea la escala. */
    <svg className="dg" viewBox={viewBox} role="img" aria-label={label} preserveAspectRatio="xMinYMid meet">
      <title>{label}</title>
      <Trama />
      <rect x={0} y={0} width={ancho} height={alto} fill={BLANCO} />
      {children}
    </svg>
  )
}

/**
 * Rótulo. Piso 20 en el viewBox, no 18: el <svg> se escala por el alto que le
 * queda a la slide, y en las slides cargadas esa escala baja a ~0,90, así que
 * un rótulo de 18 dibujado se proyectaba a 16,3 px reales —el único texto de
 * toda la jornada por debajo del piso de 20 px del deck, y justo el que lleva
 * el argumento del diagrama—. A 20/21 dibujados proyecta 18 en el peor caso y
 * 21-22 cuando la slide le deja aire.
 */
function T({ x, y, size = 21, weight = 600, fill = TINTA, anchor = 'start', opacity, ancho, espaciado, children }: {
  x: number
  y: number
  size?: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  /** Opacidad del rótulo: sirve para bajar un rótulo de zona respecto de los de dato. */
  opacity?: number
  /** Ancho fijo en unidades del viewBox: iguala celdas cuyo texto mide distinto. */
  ancho?: number
  /** letter-spacing en unidades del viewBox (versalita). */
  espaciado?: number
  children: ReactNode
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      fillOpacity={opacity}
      letterSpacing={espaciado}
      textLength={ancho}
      lengthAdjust={ancho ? 'spacingAndGlyphs' : undefined}
    >{children}</text>
  )
}

/**
 * Rótulo de registro: la versalita espaciada del sitio del programa
 * (.masthead-badge y .nav-tab son mayúsculas, letter-spacing y peso 600 en
 * azul). Es el mismo recurso para nombrar ejes, zonas, leyendas y costuras.
 */
function R({ x, y, fill = AZUL, anchor = 'start', size = 20, opacity, children }: {
  x: number
  y: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  opacity?: number
  children: ReactNode
}) {
  return <T x={x} y={y} size={size} weight={600} fill={fill} anchor={anchor} opacity={opacity} espaciado={1.9}>{children}</T>
}

/** Conclusión: la frase que se lleva la sala, siempre al pie y alineada a la izquierda. */
function Cierre({ x = 30, y, fill = TINTA, size = 20, children }: { x?: number; y: number; fill?: string; size?: number; children: ReactNode }) {
  return <T x={x} y={y} size={size} weight={700} fill={fill}>{children}</T>
}

type Tono = 'neutro' | 'firme' | 'destacado' | 'pleno' | 'riesgo' | 'tramado'

const TONOS: Record<Tono, { fill: string; stroke?: string; sw?: number; dash?: string }> = {
  neutro: { fill: BLANCO, stroke: GRIS, sw: G_CAJA },
  // La persona, la decisión y el eje se distinguen por FORMA —contorno de
  // tinta sobre blanco— y no por un segundo azul: el #14178a anterior era
  // indistinguible del azul de marca a tamaño de proyección, así que dos cajas
  // contiguas leían como el mismo azul mal calibrado.
  firme: { fill: BLANCO, stroke: TINTA, sw: G_EJE },
  destacado: { fill: AZUL_CLARO, stroke: AZUL, sw: G_EJE },
  pleno: { fill: AZUL },
  riesgo: { fill: BLANCO, stroke: TINTA, sw: G_EJE, dash: RAYA },
  tramado: { fill: TRAMA, stroke: TINTA, sw: G_EJE },
}

/** Caja: el único tratamiento de caja de la biblioteca. El tono lleva el significado. */
function Caja({ x, y, w, h, tono = 'neutro' }: { x: number; y: number; w: number; h: number; tono?: Tono }) {
  const t = TONOS[tono]
  return (
    <rect x={x} y={y} width={w} height={h} fill={t.fill} stroke={t.stroke} strokeWidth={t.sw} strokeDasharray={t.dash} />
  )
}

/** Triángulo de avance (sin marker-end: los markers no heredan color acá). */
function Punta({ x, y, dir = 'derecha', size = 11, fill = AZUL }: {
  x: number
  y: number
  dir?: 'derecha' | 'izquierda' | 'abajo' | 'arriba'
  size?: number
  fill?: string
}) {
  const s = size
  const puntos = {
    derecha: `${x - s},${y - s} ${x + s},${y} ${x - s},${y + s}`,
    izquierda: `${x + s},${y - s} ${x - s},${y} ${x + s},${y + s}`,
    abajo: `${x - s},${y - s} ${x + s},${y - s} ${x},${y + s}`,
    arriba: `${x - s},${y + s} ${x + s},${y + s} ${x},${y - s}`,
  }[dir]
  return <polygon points={puntos} fill={fill} />
}

/** Conector recto con punta: un solo grosor de flecha en los quince diagramas. */
function Flecha({ x1, y1, x2, y2, color = AZUL, dash, size = 11 }: {
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
  dash?: string
  size?: number
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'derecha' : 'izquierda') : (dy >= 0 ? 'abajo' : 'arriba')
  // El tallo se detiene antes de la punta para que no asome por el vértice.
  const largo = Math.hypot(dx, dy) || 1
  const fx = x2 - (dx / largo) * size
  const fy = y2 - (dy / largo) * size
  return (
    <g>
      <line x1={x1} y1={y1} x2={fx} y2={fy} stroke={color} strokeWidth={G_FLECHA} strokeDasharray={dash} />
      <Punta x={x2} y={y2} dir={dir} size={size} fill={color} />
    </g>
  )
}

/**
 * Marcas de talud sobre una frontera: perpendiculares cortas hacia el lado que
 * degrada. Es el recurso del dibujo técnico para señalar un corte y reemplaza
 * al relleno de color que antes pintaba la zona de riesgo.
 */
function Talud({ puntos, largo = 15, paso = 26 }: { puntos: [number, number][]; largo?: number; paso?: number }) {
  const marcas: ReactNode[] = []
  let resto = 0
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const [x1, y1] = puntos[i]
    const [x2, y2] = puntos[i + 1]
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (len === 0) continue
    const ux = (x2 - x1) / len
    const uy = (y2 - y1) / len
    let nx = -uy
    let ny = ux
    if (ny < 0) { nx = -nx; ny = -ny } // la normal siempre apunta hacia abajo
    let d = resto
    while (d < len) {
      const px = x1 + ux * d
      const py = y1 + uy * d
      marcas.push(
        <line key={`${i}-${Math.round(d)}`} x1={px} y1={py} x2={px + nx * largo} y2={py + ny * largo}
          stroke={TINTA} strokeWidth={2.4} strokeOpacity={0.55} />,
      )
      d += paso
    }
    resto = d - len
  }
  return <g>{marcas}</g>
}

/* ============================================================
   FAMILIA 1 · el marco del programa y las jornadas 2 a 8
   ============================================================ */

/* ---------- tres-ventanas · el marco del programa (motivo de las 8 jornadas) */

export function TresVentanas() {
  const ventanas = [
    { x: 30, titulo: 'HOY', sub1: 'Qué ya se puede hacer', sub2: 'y no estás haciendo', pie: 'EJECUTAR' },
    { x: 400, titulo: 'SEIS MESES', sub1: 'Qué decisión', sub2: 'dejás preparada', pie: 'PREPARAR' },
    { x: 770, titulo: 'TRES AÑOS', sub1: 'Qué cambia el modelo', sub2: 'de negocio de tu industria', pie: 'TOMAR POSICIÓN' },
  ]
  const W = 320
  return (
    <Panel label="El marco de las tres ventanas: hoy, seis meses, tres años" viewBox="0 0 1120 280">
      {ventanas.map((v, i) => {
        const hoy = i === 0
        return (
          <g key={v.titulo}>
            <Caja x={v.x} y={30} w={W} h={170} tono={hoy ? 'destacado' : 'neutro'} />
            {/* Filete de acento: el mismo gesto que la pestaña activa del sitio. */}
            <rect x={v.x + 28} y={56} width={54} height={G_EJE} fill={hoy ? AZUL : GRIS} />
            <T x={v.x + 28} y={102} size={27} weight={800} fill={hoy ? AZUL : TINTA}>{v.titulo}</T>
            <T x={v.x + 28} y={142} size={21} weight={500}>{v.sub1}</T>
            <T x={v.x + 28} y={168} size={21} weight={500}>{v.sub2}</T>
            <R x={v.x + W / 2} y={240} anchor="middle" fill={hoy ? AZUL : GRIS}>{v.pie}</R>
          </g>
        )
      })}
      <Flecha x1={358} y1={115} x2={392} y2={115} />
      <Flecha x1={728} y1={115} x2={762} y2={115} />
    </Panel>
  )
}

/* ---------- anatomia-producto · tres capas y dos costuras (B2) */

export function AnatomiaProducto() {
  const capas = [
    { y: 20, tono: 'destacado' as Tono, titulo: 'FRONT', sub: 'lo que el usuario ve y toca — el salón', color: AZUL },
    { y: 122, tono: 'neutro' as Tono, titulo: 'BACK', sub: 'lógica + base de datos — la cocina', color: TINTA },
  ]
  const costuras = [
    { y: 100, texto: 'COSTURA 1 · LA API PROPIA' },
    { y: 202, texto: 'COSTURA 2 · APIS DE TERCEROS' },
  ]
  const servicios = ['login', 'pagos', 'mapas', 'mensajería', 'modelo de IA']
  return (
    <Panel label="Anatomía de un producto digital: front, back y servicios de terceros, unidos por dos costuras" viewBox="0 0 1120 336">
      {/* Las tres capas ocupan el mismo ancho: se leen apiladas, no escalonadas. */}
      {capas.map((c) => (
        <g key={c.titulo}>
          <Caja x={36} y={c.y} w={1048} h={58} tono={c.tono} />
          <T x={66} y={c.y + 37} size={24} weight={800} fill={c.color}>{c.titulo}</T>
          <T x={1054} y={c.y + 37} size={21} weight={500} fill={GRIS} anchor="end">{c.sub}</T>
        </g>
      ))}

      {costuras.map((s) => (
        <g key={s.texto}>
          {/* La línea se interrumpe para dejar entrar el rótulo: nada de texto sobre trazo. */}
          <line x1={66} y1={s.y} x2={360} y2={s.y} stroke={AZUL} strokeWidth={G_EJE} strokeDasharray={RAYA} />
          <line x1={760} y1={s.y} x2={1054} y2={s.y} stroke={AZUL} strokeWidth={G_EJE} strokeDasharray={RAYA} />
          <R x={560} y={s.y + 6} anchor="middle">{s.texto}</R>
        </g>
      ))}

      {servicios.map((s, i) => (
        <g key={s}>
          <Caja x={36 + i * 212} y={224} w={200} h={54} />
          <T x={136 + i * 212} y={257} size={20} anchor="middle">{s}</T>
        </g>
      ))}

      <Cierre x={36} y={320}>servicios alquilados — los proveedores</Cierre>
    </Panel>
  )
}

/* ---------- build-buy · la frontera (B2/B3) */

export function BuildBuy() {
  return (
    <Panel label="Build versus buy: se construye lo diferencial, se compra lo que es igual para todos" viewBox="0 0 1120 344">
      <Caja x={310} y={20} w={500} h={80} tono="destacado" />
      <T x={560} y={50} size={20} weight={500} fill={GRIS} anchor="middle">la única pregunta que sobrevive:</T>
      <T x={560} y={82} size={23} weight={800} fill={AZUL} anchor="middle">¿es diferencial de TU negocio?</T>

      {/* Bifurcación ortogonal: la misma forma de ramificar del organigrama
          institucional. Cada rama se pinta entera del color de su destino. */}
      <line x1={560} y1={100} x2={560} y2={128} stroke={AZUL} strokeWidth={G_FLECHA} />
      <line x1={295} y1={128} x2={562} y2={128} stroke={AZUL} strokeWidth={G_FLECHA} />
      <line x1={558} y1={128} x2={825} y2={128} stroke={GRIS} strokeWidth={G_FLECHA} />
      <Flecha x1={295} y1={128} x2={295} y2={158} />
      <Flecha x1={825} y1={128} x2={825} y2={158} color={GRIS} />
      <R x={312} y={120}>SÍ</R>
      <R x={808} y={120} anchor="end" fill={GRIS}>NO</R>

      <Caja x={60} y={168} w={470} h={132} tono="destacado" />
      <T x={295} y={210} size={25} weight={800} fill={AZUL} anchor="middle">CONSTRUIR</T>
      <T x={295} y={246} size={21} weight={500} anchor="middle">barato hoy · tuyo para siempre</T>
      <T x={295} y={274} size={21} weight={500} fill={GRIS} anchor="middle">el costo real: sostenerlo</T>

      <Caja x={590} y={168} w={470} h={132} />
      <T x={825} y={210} size={25} weight={800} anchor="middle">COMPRAR</T>
      <T x={825} y={246} size={21} weight={500} anchor="middle">rápido hoy · dependencia para siempre</T>
      <T x={825} y={274} size={21} weight={500} fill={GRIS} anchor="middle">login propio = hackeo propio</T>

      <Cierre x={60} y={334}>ningún camino es gratis: se elige qué riesgo preferís</Cierre>
    </Panel>
  )
}

/* ---------- modelo-problema · tres familias, tres materias primas (B3) */

export function ModeloProblema() {
  const filas = [
    { y: 46, fam: 'ML clásico', dato: 'tablas con historia', ej: 'churn · demanda · morosidad' },
    { y: 130, fam: 'Redes neuronales', dato: 'imagen · voz · señal', ej: 'defectos en línea · firmas' },
    { y: 214, fam: 'LLMs', dato: 'lenguaje y razonamiento', ej: 'reclamos · contratos · mails' },
  ]
  return (
    <Panel label="Mapa modelo problema: cada familia de modelos tiene su materia prima" viewBox="0 0 1120 344">
      <R x={30} y={32}>FAMILIA DE MODELOS</R>
      <R x={436} y={32}>SU MATERIA PRIMA · EJEMPLOS</R>
      {filas.map((f) => (
        <g key={f.fam}>
          <Caja x={30} y={f.y} w={330} h={72} tono="destacado" />
          <T x={195} y={f.y + 45} size={22} weight={800} fill={AZUL} anchor="middle">{f.fam}</T>
          <Flecha x1={372} y1={f.y + 36} x2={424} y2={f.y + 36} />
          <Caja x={436} y={f.y} w={654} h={72} />
          <T x={763} y={f.y + 34} size={20} weight={700} anchor="middle">{f.dato}</T>
          <T x={763} y={f.y + 60} size={20} weight={500} fill={GRIS} anchor="middle">{f.ej}</T>
        </g>
      ))}
      <Cierre y={332}>regla: el modelo más simple que le gane al baseline</Cierre>
    </Panel>
  )
}

/* ---------- hitl-flow · human in the loop como diseño (B5) */

export function HitlFlow() {
  return (
    <Panel label="Flujo human in the loop: el agente resuelve, el umbral decide cuándo escala a una persona" viewBox="0 0 1120 344">
      <Caja x={24} y={142} w={170} h={64} />
      <T x={109} y={181} size={20} weight={700} anchor="middle">reclamo</T>
      <Flecha x1={200} y1={174} x2={240} y2={174} />

      <Caja x={250} y={134} w={230} h={80} tono="destacado" />
      <T x={365} y={168} size={21} weight={800} fill={AZUL} anchor="middle">el agente</T>
      <T x={365} y={196} size={20} weight={500} anchor="middle">clasifica y propone</T>
      <Flecha x1={486} y1={174} x2={530} y2={174} />

      <polygon points="660,104 780,174 660,244 540,174" fill={BLANCO} stroke={TINTA} strokeWidth={G_EJE} />
      <T x={660} y={168} size={20} weight={700} anchor="middle">¿supera</T>
      <T x={660} y={196} size={20} weight={700} anchor="middle">el umbral?</T>

      {/* Rama NO: resuelve solo. */}
      <line x1={660} y1={104} x2={660} y2={82} stroke={GRIS} strokeWidth={G_FLECHA} />
      <Flecha x1={660} y1={82} x2={802} y2={82} color={GRIS} />
      <R x={674} y={72} fill={GRIS}>NO</R>
      <Caja x={812} y={44} w={278} h={76} />
      <T x={951} y={78} size={20} weight={700} anchor="middle">resuelve solo</T>
      <T x={951} y={104} size={20} weight={500} fill={GRIS} anchor="middle">auditoría por muestreo</T>

      {/* Rama SÍ: la persona. Contorno de tinta sobre blanco, el mismo recurso
          con el que se dibuja la responsabilidad humana en el resto de la
          biblioteca. Las dos ramas rotulan igual: son las dos salidas válidas
          de la misma decisión y el azul no puede sugerir que una vale más. */}
      <line x1={660} y1={244} x2={660} y2={266} stroke={AZUL} strokeWidth={G_FLECHA} />
      <Flecha x1={660} y1={266} x2={802} y2={266} />
      <R x={674} y={258} fill={GRIS}>SÍ</R>
      <Caja x={812} y={228} w={278} h={76} tono="firme" />
      <T x={951} y={262} size={20} weight={700} anchor="middle">escala a persona</T>
      <T x={951} y={288} size={20} weight={500} fill={GRIS} anchor="middle">aprueba o corrige</T>

      {/* Leyenda del diagrama —no conclusión—: mismo registro que la de
          tres-ventanas. */}
      <R x={24} y={334} size={21}>PERSONA ANTES · PERSONA EN LA EXCEPCIÓN · PERSONA DESPUÉS</R>
    </Panel>
  )
}

/* ---------- curva-adopcion · hábito vs. demo (B6 producto) */

export function CurvaAdopcion() {
  return (
    <Panel label="Curvas de retención por cohorte: la que se aplana es hábito, la que muere a cero era una demo" viewBox="0 0 1120 316">
      <line x1={96} y1={36} x2={96} y2={268} stroke={GRIS} strokeWidth={G_EJE} />
      <line x1={96} y1={268} x2={1080} y2={268} stroke={GRIS} strokeWidth={G_EJE} />
      <R x={588} y={302} anchor="middle">SEMANAS DESDE EL ALTA</R>
      <text x={58} y={152} fontSize={20} fontWeight={600} fill={GRIS} textAnchor="middle" letterSpacing={1.9} transform="rotate(-90 58 152)">RETENCIÓN</text>

      {/* La cohorte con hábito: trazo azul pleno, el más grueso del panel. */}
      <path d="M 96 59 C 263 59, 294 152, 446 166 C 629 182, 842 185, 1080 187" fill="none" stroke={AZUL} strokeWidth={G_CURVA} />
      <T x={890} y={162} size={20} weight={700} fill={AZUL} anchor="middle">se aplana: hay hábito</T>

      {/* La que se cae: trazo de tinta punteado, sin color de alerta. Se acerca
          al eje sin apoyarse en él, para que no se confunda con el propio eje. */}
      <path d="M 96 59 C 233 82, 294 208, 446 236 C 599 255, 781 260, 1080 261" fill="none" stroke={TINTA} strokeWidth={G_FLECHA} strokeDasharray="11 7" />
      <T x={700} y={242} size={20} weight={700} anchor="middle">muere a cero: era una demo</T>
    </Panel>
  )
}

/* ---------- estructura-costos · lo cotizado vs. el mes 12 (B6 dirigir) */

export function EstructuraCostos() {
  const x0 = 40
  const cotizado = 350
  const reales = [
    { y: 118, w: 467, t: 'licencias y tokens variables' },
    { y: 158, w: 700, t: 'integración con tus sistemas' },
    { y: 198, w: 607, t: 'datos limpios que el sistema come' },
    { y: 238, w: 513, t: 'soporte interno + 20% del referente' },
    { y: 278, w: 420, t: 'rediseño cuando el proceso cambia' },
  ]
  return (
    <Panel label="Estructura de costos reales: lo que el proveedor cotiza contra lo que se paga en el mes 12" viewBox="0 0 1120 345">
      <R x={x0} y={30}>LO QUE SE COTIZA</R>
      <rect x={x0} y={38} width={cotizado} height={32} fill={AZUL} />
      <T x={x0 + cotizado + 18} y={60} size={21}>la licencia, el día de la firma</T>

      <R x={x0} y={104}>LO QUE SE PAGA · EL MES 12</R>
      {/* Mismo origen y misma escala que la barra de arriba: la comparación se
          lee sin leyenda. La trama pinta el costo que no estaba cotizado; el
          contorno va sólido para que la trama sea lo que se ve, y el texto
          siempre queda afuera. */}
      {reales.map((r) => (
        <g key={r.t}>
          <rect x={x0} y={r.y} width={r.w} height={32} fill={TRAMA} stroke={TINTA} strokeWidth={2.4} />
          <T x={x0 + r.w + 18} y={r.y + 23} size={21}>{r.t}</T>
        </g>
      ))}

      <Cierre x={x0} y={336}>el número que importa es el del mes 12, no el del día de la firma</Cierre>
    </Panel>
  )
}

/* ---------- stack-costuras · casi nada es propio (B2) */

export function StackCosturas() {
  const piezas = ['login', 'pagos', 'mapas', 'mensajería', 'modelo de IA', 'hosting']
  const xs = [60, 445, 830]
  const anclas = [440, 560, 680]
  return (
    <Panel label="El stack como piezas alquiladas cosidas por APIs alrededor del diferencial propio" viewBox="0 0 1120 344">
      <Caja x={400} y={126} w={320} h={92} tono="pleno" />
      <T x={560} y={166} size={25} weight={800} fill={BLANCO} anchor="middle">LO TUYO</T>
      <T x={560} y={196} size={21} weight={500} fill={BLANCO} opacity={0.88} anchor="middle">el diferencial del negocio</T>

      {piezas.map((p, i) => {
        const arriba = i < 3
        const x = xs[i % 3]
        const y = arriba ? 20 : 252
        const cx = x + 115
        return (
          <g key={p}>
            <Caja x={x} y={y} w={230} h={52} />
            <T x={cx} y={y + 33} size={20} anchor="middle">{p}</T>
            <line
              x1={cx}
              y1={arriba ? 76 : 248}
              x2={anclas[i % 3]}
              y2={arriba ? 122 : 222}
              stroke={AZUL}
              strokeWidth={G_EJE}
              strokeDasharray={RAYA}
            />
          </g>
        )
      })}

      {/* Leyenda con muestra: la caja neutra es una pieza, la raya azul una costura. */}
      <Caja x={30} y={158} w={26} h={20} />
      <R x={66} y={176} fill={GRIS}>PIEZAS ALQUILADAS</R>
      <line x1={856} y1={170} x2={892} y2={170} stroke={AZUL} strokeWidth={G_EJE} strokeDasharray={RAYA} />
      <R x={1090} y={176} anchor="end">COSTURAS = APIS</R>

      <Cierre y={332}>casi nada es propio: las costuras son APIs y lo tuyo es el diferencial</Cierre>
    </Panel>
  )
}

/* ============================================================
   FAMILIA 2 · diagramas de la Jornada 1
   ============================================================ */

/* ---------- saltos-mecanismo · la historia por mecanismos, no por fechas (J1 cap. 2) */

export function SaltosMecanismo() {
  const estaciones = [
    { nombre: 'ESCRIBIR REGLAS', ancla: 'ELIZA · Deep Blue', deja: ['calcular y buscar', 'a mano'], nuevo: ['escribir y mantener', 'cada regla'] },
    { nombre: 'MOSTRAR EJEMPLOS', ancla: 'AlexNet · AlphaGo', deja: ['escribir la regla', 'una por una'], nuevo: ['juntar ejemplos y', 'medir el error'] },
    { nombre: 'COMPRAR CAPACIDAD', ancla: 'Transformer · GPT-3', deja: ['entrenar un modelo', 'propio'], nuevo: ['elegir proveedor y', 'pagar por respuesta'] },
    { nombre: 'PEDIRLO HABLANDO', ancla: 'InstructGPT · hoy', deja: ['programar para', 'poder pedirlo'], nuevo: ['verificar lo que', 'promete — y firmar'] },
  ]
  const centros = [167, 429, 691, 953]
  return (
    <Panel label="Los cuatro saltos de la IA por mecanismo: qué trabajo deja de hacerse a mano y qué trabajo nuevo aparece en cada uno" viewBox="0 0 1120 360">
      {/* Las dos categorías están codificadas por FILA, así que los rótulos van
          uno arriba de su fila y otro arriba de la otra. Puestos lado a lado
          arriba de todo, la sala leía «las dos de la izquierda son una cosa y
          las dos de la derecha son la otra», o sea al revés del diagrama. */}
      <R x={40} y={26}>LO QUE DEJA DE HACERSE A MANO</R>

      <rect x={40} y={134} width={1040} height={44} fill={AZUL} />
      {[298, 560, 822].map((x) => <Punta key={x} x={x} y={156} size={11} fill={BLANCO} />)}

      <R x={40} y={224} fill={TINTA}>EL TRABAJO NUEVO QUE APARECE</R>

      {estaciones.map((e, i) => {
        const c = centros[i]
        return (
          <g key={e.nombre}>
            <Caja x={c - 120} y={36} w={240} h={84} tono="destacado" />
            <T x={c} y={67} size={21} anchor="middle" fill={AZUL}>{e.deja[0]}</T>
            <T x={c} y={93} size={21} anchor="middle" fill={AZUL}>{e.deja[1]}</T>

            {/* ancho fijo: las cuatro estaciones ocupan lo mismo, así que el aire
                a los dos lados de cada chevron es idéntico y desde el fondo se
                leen cuatro celdas y no tres. */}
            <T x={c} y={163} size={21} weight={800} anchor="middle" fill={BLANCO} ancho={206}>{e.nombre}</T>
            <T x={c} y={199} size={20} weight={500} anchor="middle" fill={GRIS}>{e.ancla}</T>

            <Caja x={c - 120} y={234} w={240} h={84} />
            <T x={c} y={265} size={21} anchor="middle">{e.nuevo[0]}</T>
            <T x={c} y={291} size={21} anchor="middle">{e.nuevo[1]}</T>
          </g>
        )
      })}
      <Cierre x={40} y={348}>cada salto corre el trabajo de lugar; ninguno lo hace desaparecer</Cierre>
    </Panel>
  )
}

/* ---------- anatomia-ocho-horas · el cuello de botella es la espera (J1 cap. 1 y 6) */

export function AnatomiaOchoHoras() {
  const x0 = 60
  const px = 1000 / 480 // el reloj del caso: 480 minutos sobre 1000 unidades
  const activo = 24 * px
  const espera = 360 * px
  const cola = 96 * px
  const competidor = x0 + 60 * px
  const centroEspera = x0 + activo + espera / 2
  return (
    <Panel label="Anatomía de las ocho horas de una cotización: 24 minutos de trabajo activo contra seis horas esperando una autorización" viewBox="0 0 1120 344">
      {Array.from({ length: 9 }, (_, h) => {
        const x = x0 + h * 60 * px
        return (
          <g key={h}>
            <line x1={x} y1={138} x2={x} y2={150} stroke={GRIS} strokeWidth={2.4} />
            <T x={x} y={130} size={20} weight={500} anchor="middle" fill={GRIS}>{`${h} h`}</T>
          </g>
        )
      })}

      <rect x={x0} y={150} width={activo} height={76} fill={AZUL} />
      {/* La espera va tramada: es pérdida medible, y el tramado la nombra sin
          pedirle prestado un color de alerta a otra marca. */}
      <rect x={x0 + activo} y={150} width={espera} height={76} fill={TRAMA} stroke={TINTA} strokeWidth={G_EJE} />
      <rect x={x0 + activo + espera} y={150} width={cola} height={76} fill={BLANCO} stroke={GRIS} strokeWidth={G_CAJA} />

      {/* Los tres bloques se rotulan sólo por duración: el diagnóstico lo
          nombra la sala, no la pantalla. La cifra de la espera va sobre una
          cartela blanca porque sobre el tramado nunca va texto. */}
      <rect x={centroEspera - 84} y={162} width={168} height={52} fill={BLANCO} stroke={TINTA} strokeWidth={2.4} />
      <T x={centroEspera} y={202} size={38} weight={800} anchor="middle">6 h</T>
      <T x={x0 + activo + espera + cola / 2} y={194} size={21} weight={700} anchor="middle">1 h 36</T>
      <T x={x0 + activo + espera + cola / 2} y={252} size={20} weight={500} anchor="middle" fill={GRIS}>cola, armado y traslado</T>

      <T x={60} y={82} size={21} weight={800} fill={AZUL}>24 min de trabajo activo</T>
      <line x1={x0 + activo / 2} y1={92} x2={x0 + activo / 2} y2={150} stroke={AZUL} strokeWidth={G_EJE} />

      <line x1={competidor} y1={226} x2={competidor} y2={276} stroke={TINTA} strokeWidth={G_FLECHA} />
      <T x={competidor + 16} y={296} size={20} weight={700}>acá cotizó el competidor: 1 h</T>
    </Panel>
  )
}

/* ---------- capacidad-vs-valor · ahorrar horas no es ganar plata (J1 cap. 6) */

export function CapacidadVsValor() {
  return (
    <Panel label="Capacidad liberada contra valor capturado: las horas ahorradas se reasignan con o sin decisión" viewBox="0 0 1120 340">
      <R x={40} y={36} fill={GRIS}>200 COTIZACIONES POR SEMANA × 24 MIN = 80 H</R>

      <rect x={40} y={62} width={180} height={80} fill={AZUL} />
      <T x={130} y={104} size={26} weight={800} anchor="middle" fill={BLANCO}>33 h 20</T>
      <T x={130} y={128} size={21} anchor="middle" fill={BLANCO}>liberadas</T>
      <rect x={40} y={142} width={180} height={112} fill={BLANCO} stroke={GRIS} strokeWidth={G_CAJA} />
      <T x={130} y={192} size={22} weight={700} anchor="middle">46 h 40</T>
      <T x={130} y={218} size={20} weight={500} anchor="middle" fill={GRIS}>siguen cotizando</T>
      {/* Es la conclusión del bloque de la izquierda, no una leyenda: tinta. */}
      <R x={40} y={284} fill={TINTA}>CAPACIDAD, NO RESULTADO</R>

      <Flecha x1={228} y1={102} x2={314} y2={102} />

      <Caja x={326} y={56} w={250} h={100} tono="firme" />
      <T x={451} y={98} size={20} weight={700} anchor="middle">¿alguien decide</T>
      <T x={451} y={126} size={20} weight={700} anchor="middle">a qué se reasignan?</T>

      <Flecha x1={582} y1={92} x2={662} y2={66} />
      <Flecha x1={582} y1={130} x2={664} y2={204} color={TINTA} dash={RAYA} />

      <Caja x={672} y={32} w={408} h={92} tono="destacado" />
      <T x={696} y={70} size={20} weight={700} fill={AZUL}>sí: van a trabajo que vende</T>
      <T x={696} y={100} size={21}>valor capturado — se puede medir</T>

      {/* La rama que pierde va con UN solo recurso: contorno punteado, que es
          «no comprobado». La franja de 30 px de tramado que había además al
          canto no llegaba al texto y proyectada no leía como «pérdida no
          comprobada» sino como un relleno cortado; la gramática de la
          biblioteca dice que tramado y punteado no se superponen. */}
      <Caja x={672} y={168} w={408} h={92} tono="riesgo" />
      <T x={700} y={206} size={20} weight={700}>no: se las come el mismo trabajo</T>
      <T x={700} y={236} size={20}>la capacidad se evapora sin registro</T>

      <Cierre x={40} y={322}>si nadie decide, se reasignan igual: ahorrar tiempo no es ganar plata</Cierre>
    </Panel>
  )
}

/* ---------- frontera-despareja · dónde ayuda y dónde degrada (J1 cap. 5) */

export function FronteraDespareja() {
  const borde: [number, number][] = [
    [60, 212], [200, 150], [340, 172], [480, 112], [620, 206], [760, 142], [900, 238], [1060, 176],
  ]
  const cadena = borde.map(([x, y]) => `${x},${y}`).join(' ')
  const ayuda = [
    { x: 200, y: 118, t: 'borrador de la oferta' },
    { x: 480, y: 80, t: 'resumen del pedido' },
    { x: 790, y: 104, t: 'una herramienta chica' },
  ]
  const degrada = [
    { x: 330, y: 248, t: 'elegir el descuento' },
    { x: 620, y: 264, t: 'afirmar que hay stock' },
    { x: 900, y: 288, t: 'la excepción del contrato' },
  ]
  return (
    <Panel label="La frontera despareja de la capacidad: tareas donde el modelo ayuda, tareas donde degrada y un borde difuso que no viene señalizado" viewBox="0 0 1120 356">
      {/* Arriba, la zona teñida de azul claro: acá la capacidad acompaña.
          Abajo queda el papel en blanco, sin señalizar, que es justamente el
          argumento; el talud marca de qué lado se cae. */}
      <polygon points={`60,44 1060,44 ${[...borde].reverse().map(([x, y]) => `${x},${y}`).join(' ')}`} fill={AZUL_CLARO} />
      <polyline points={cadena} fill="none" stroke={TINTA} strokeWidth={22} strokeOpacity={0.1} />
      <Talud puntos={borde} />
      <polyline points={cadena} fill="none" stroke={TINTA} strokeWidth={G_FLECHA} strokeDasharray="12 8" />

      {/* Rótulos de ZONA. «ACÁ DEGRADA» estaba en gris contra un «ACÁ AYUDA»
          en azul de marca: proyectada, la mitad que el título manda mirar —el
          título dice «no declares que la IA sirve»— era la primera que se
          apagaba y quedaba en pantalla la mitad optimista. El lado lo
          diferencia el talud, no hacía falta que además lo bajara el color:
          los dos renglones van en TINTA, con el mismo peso y espaciado. */}
      <R x={76} y={78} size={21}>ACÁ AYUDA</R>
      <R x={76} y={264} size={21} fill={TINTA}>ACÁ DEGRADA</R>
      <R x={76} y={290} size={21} fill={TINTA}>Y SUENA IGUAL DE SEGURO</R>

      {ayuda.map((p) => (
        <g key={p.t}>
          <circle cx={p.x} cy={p.y + 16} r={8} fill={AZUL} />
          <T x={p.x} y={p.y} size={21} weight={700} anchor="middle" fill={AZUL}>{p.t}</T>
        </g>
      ))}
      {degrada.map((p) => (
        <g key={p.t}>
          <circle cx={p.x} cy={p.y - 26} r={9} fill={BLANCO} stroke={TINTA} strokeWidth={G_EJE} />
          <T x={p.x} y={p.y} size={21} weight={700} anchor="middle">{p.t}</T>
        </g>
      ))}

      <R x={1080} y={28} size={20} anchor="end" fill={GRIS}>UNA TAREA, UN PUNTO · TAREAS DEL CASO</R>
      <Cierre x={40} y={348}>el borde existe, se mueve y no está marcado: probá tarea por tarea</Cierre>
    </Panel>
  )
}

/* ---------- cuatro-operaciones · generar, consultar, ejecutar, verificar (J1 cap. 3) */

export function CuatroOperaciones() {
  const ops: { t: string; l: string[]; duro: number[] }[] = [
    { t: 'GENERAR', l: ['escribe algo plausible', 'puede inventar el dato', 'no comprobó nada'], duro: [1, 2] },
    { t: 'CONSULTAR', l: ['pregunta al catálogo', 'y al stock real', 'trae dato, no texto'], duro: [] },
    { t: 'EJECUTAR', l: ['reserva, emite, cobra', 'tiene efecto real', 'por eso pide permiso'], duro: [] },
    { t: 'VERIFICAR', l: ['revisa lo que promete', 'y se hace responsable', 'la IA no firma'], duro: [] },
  ]
  const xs = [30, 300, 570, 840]
  const w = 250
  return (
    <Panel label="Las cuatro operaciones de un sistema: el modelo genera, el sistema consulta y ejecuta, una persona verifica y firma" viewBox="0 0 1120 340">
      {/* Las tres bandas de responsabilidad. Contorno punteado = lo que nadie
          comprobó todavía; tinta plena = quien se hace cargo. */}
      <Caja x={30} y={40} w={250} h={40} tono="riesgo" />
      <T x={155} y={67} size={21} weight={700} anchor="middle">el modelo infiere</T>
      <Caja x={300} y={40} w={520} h={40} tono="destacado" />
      <T x={560} y={67} size={21} weight={700} fill={AZUL} anchor="middle">el sistema comprueba</T>
      <Caja x={840} y={40} w={250} h={40} tono="firme" />
      <T x={965} y={67} size={21} weight={700} anchor="middle">una persona responde</T>

      {ops.map((o, i) => (
        <g key={o.t}>
          {/* GENERAR queda con contorno punteado (no comprobado) y VERIFICAR con
              contorno de tinta plena (alguien firma); las dos del medio, neutras. */}
          <Caja x={xs[i]} y={104} w={w} h={152} tono={i === 0 ? 'riesgo' : i === 3 ? 'firme' : 'neutro'} />
          <T x={xs[i] + w / 2} y={142} size={23} weight={800} anchor="middle">{o.t}</T>
          {o.l.map((linea, j) => (
            <T key={linea} x={xs[i] + w / 2} y={178 + j * 27} size={20} weight={o.duro.includes(j) ? 700 : 500}
              fill={o.duro.includes(j) ? TINTA : GRIS} anchor="middle">{linea}</T>
          ))}
          {i < 3 ? <Punta x={xs[i] + w + 10} y={180} size={10} fill={AZUL} /> : null}
        </g>
      ))}

      <Cierre y={290}>una afirmación sobre stock no se vuelve verdadera por estar bien redactada</Cierre>
      <Cierre y={318} fill={AZUL}>la decisión de diseño es una: qué puede inferir y qué tiene que consultar</Cierre>
    </Panel>
  )
}

/* ---------- costo-de-crear · cuando el costo cae, cambia quién puede jugar (J1 cap. 3 y 6) */

export function CostoDeCrear() {
  const hitos = [
    { x: 190, y: 98, nombre: 'software a medida', quien: 'un equipo de ingeniería' },
    { x: 450, y: 178, nombre: 'framework y nube', quien: 'un desarrollador' },
    { x: 720, y: 219, nombre: 'API de modelos', quien: 'un técnico solo' },
    { x: 980, y: 243, nombre: 'pedirlo en palabras', quien: 'cualquiera del equipo' },
  ]
  return (
    <Panel label="El costo de crear un producto cae con el tiempo y con cada caída cambia quién puede construirlo; sostenerlo y firmarlo no baja" viewBox="0 0 1120 352">
      <line x1={70} y1={60} x2={70} y2={250} stroke={GRIS} strokeWidth={G_EJE} />
      <line x1={70} y1={250} x2={1070} y2={250} stroke={GRIS} strokeWidth={G_EJE} />
      <text x={44} y={158} fontSize={20} fontWeight={600} fill={GRIS} textAnchor="middle" letterSpacing={1.9} transform="rotate(-90 44 158)">COSTO DE CREAR</text>
      {/* Debajo del trazo del eje, no adentro del área de trazado: a media
          altura y entre las curvas leía como un rótulo de dato. */}
      <R x={76} y={278}>TIEMPO →</R>

      <path d="M 92 84 C 130 86, 155 90, 190 98 C 275 118, 355 156, 450 178 C 550 200, 630 210, 720 219 C 820 231, 920 239, 1056 246" fill="none" stroke={AZUL} strokeWidth={G_CURVA} />

      {/* Lo que no baja: trazo de tinta punteado, el mismo recurso con el que se
          dibuja el riesgo en toda la biblioteca. */}
      <line x1={450} y1={124} x2={1050} y2={124} stroke={TINTA} strokeWidth={G_FLECHA} strokeDasharray="11 7" />
      <T x={1050} y={112} size={20} weight={800} anchor="end">sostenerlo y firmarlo: no baja</T>

      {hitos.map((h) => (
        <g key={h.nombre}>
          <line x1={h.x} y1={h.y + 12} x2={h.x} y2={262} stroke={GRIS} strokeWidth={2.4} strokeDasharray="5 6" />
          <circle cx={h.x} cy={h.y} r={9} fill={AZUL} />
          <T x={h.x} y={h.y - 28} size={21} weight={700} anchor="middle">{h.nombre}</T>
          <Caja x={h.x - 120} y={282} w={240} h={40} tono="firme" />
          <T x={h.x} y={309} size={20} weight={700} anchor="middle">{h.quien}</T>
        </g>
      ))}
      {/* Caption de la fila de cajas, apoyado debajo de ella. Arriba, a la
          altura del eje, se tocaba con la caja «cualquiera del equipo» y con
          el punto final de la curva: tres elementos en la misma esquina. */}
      <R x={1100} y={344} anchor="end">QUIÉN JUEGA</R>
    </Panel>
  )
}

/* ---------- sensacion-vs-cronometro · la brecha entre lo que se siente y lo que se mide (J1 cap. 5) */

export function SensacionVsCronometro() {
  const cero = 600
  const esc = 14 // 1% = 14 unidades
  return (
    <Panel label="La brecha entre la sensación y el cronómetro: esperaban ser 24% más rápidos, creyeron serlo 20% y midieron 19% más lento" viewBox="0 0 1120 320">
      <R x={560} y={42} anchor="end">← MÁS RÁPIDO</R>
      <R x={640} y={42}>MÁS LENTO →</R>
      <line x1={cero} y1={54} x2={cero} y2={254} stroke={TINTA} strokeWidth={G_FLECHA} />
      <R x={cero} y={278} anchor="middle" fill={GRIS}>IGUAL QUE SIN IA</R>

      <rect x={cero - 24 * esc} y={64} width={24 * esc} height={48} fill={AZUL_CLARO} stroke={AZUL} strokeWidth={G_EJE} />
      <T x={cero - 24 * esc - 14} y={96} size={21} weight={800} anchor="end" fill={AZUL}>24% más rápido</T>
      <T x={cero + 18} y={96} size={20}>lo que esperaban antes</T>

      <rect x={cero - 20 * esc} y={130} width={20 * esc} height={48} fill={BLANCO} stroke={AZUL} strokeWidth={G_EJE} strokeDasharray="8 6" />
      <T x={cero - 20 * esc - 14} y={162} size={21} weight={800} anchor="end" fill={AZUL}>20% más rápido</T>
      <T x={cero + 18} y={162} size={20}>lo que creyeron después</T>

      {/* Lo que el cronómetro midió y nadie sintió: pérdida, o sea tramado. */}
      <rect x={cero} y={196} width={19 * esc} height={48} fill={TRAMA} stroke={TINTA} strokeWidth={G_EJE} />
      <T x={cero + 19 * esc + 16} y={228} size={22} weight={800}>19% más lento</T>
      <T x={cero - 18} y={228} size={20} anchor="end">lo que midió el cronómetro</T>

      <Cierre x={40} y={308}>preguntarle al equipo cuánto ganó no mide cuánto ganó</Cierre>
    </Panel>
  )
}

/* ---------- registro ---------- */

export const DECK_DIAGRAMS: Record<string, ComponentType> = {
  'tres-ventanas': TresVentanas,
  'anatomia-producto': AnatomiaProducto,
  'build-buy': BuildBuy,
  'modelo-problema': ModeloProblema,
  'hitl-flow': HitlFlow,
  'curva-adopcion': CurvaAdopcion,
  'estructura-costos': EstructuraCostos,
  'stack-costuras': StackCosturas,
  // Jornada 1
  'saltos-mecanismo': SaltosMecanismo,
  'anatomia-ocho-horas': AnatomiaOchoHoras,
  'capacidad-vs-valor': CapacidadVsValor,
  'frontera-despareja': FronteraDespareja,
  'cuatro-operaciones': CuatroOperaciones,
  'costo-de-crear': CostoDeCrear,
  'sensacion-vs-cronometro': SensacionVsCronometro,
}
