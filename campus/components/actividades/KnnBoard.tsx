'use client'

import { useMemo, useState } from 'react'
import { rng } from '@/lib/actividades/types'

/* Tablero de KNN para proyectar (J5). Todo local: no se guarda nada. */

interface Pt { x: number; y: number; si: boolean }
const W = 640
const H = 400
const PAD = 40

function ejemplo(): Pt[] {
  const r = rng(5)
  const pts: Pt[] = []
  for (let i = 0; i < 9; i++) pts.push({ x: 2 + r() * 8, y: 1 + r() * 10, si: true })
  for (let i = 0; i < 11; i++) pts.push({ x: 10 + r() * 15, y: 4 + r() * 25, si: false })
  return pts.map((p) => ({ ...p, x: Math.round(p.x), y: Math.round(p.y) }))
}

export function KnnBoard() {
  const [xMax, setXMax] = useState(30)
  const [yMax, setYMax] = useState(30)
  const [ejeX, setEjeX] = useState('Años en la empresa')
  const [ejeY, setEjeY] = useState('Personas a cargo')
  const [pts, setPts] = useState<Pt[]>([])
  const [query, setQuery] = useState<{ x: number; y: number } | null>(null)
  const [k, setK] = useState(3)
  const [modo, setModo] = useState<'si' | 'no' | 'caso'>('si')
  const [normalizar, setNormalizar] = useState(false)

  const sx = (x: number) => PAD + (x / xMax) * (W - 2 * PAD)
  const sy = (y: number) => H - PAD - (y / yMax) * (H - 2 * PAD)

  const ranking = useMemo(() => {
    if (!query || !pts.length) return []
    const xs = pts.map((p) => p.x).concat(query.x)
    const ys = pts.map((p) => p.y).concat(query.y)
    const rangeX = normalizar ? (Math.max(...xs) - Math.min(...xs)) || 1 : 1
    const rangeY = normalizar ? (Math.max(...ys) - Math.min(...ys)) || 1 : 1
    return pts.map((p, i) => ({ i, d: Math.hypot((p.x - query.x) / rangeX, (p.y - query.y) / rangeY) })).sort((a, b) => a.d - b.d)
  }, [pts, query, normalizar])

  const vecinos = ranking.slice(0, k)
  const votosSi = vecinos.filter((v) => pts[v.i].si).length
  const decision = vecinos.length ? (votosSi * 2 > vecinos.length ? 'Sí' : votosSi * 2 === vecinos.length ? 'Empate' : 'No') : null
  const radio = vecinos.length ? vecinos[vecinos.length - 1] : null

  function click(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const py = ((e.clientY - box.top) / box.height) * H
    const x = Math.max(0, Math.min(xMax, Math.round(((px - PAD) / (W - 2 * PAD)) * xMax)))
    const y = Math.max(0, Math.min(yMax, Math.round(((H - PAD - py) / (H - 2 * PAD)) * yMax)))
    if (modo === 'caso') { setQuery({ x, y }); return }
    const si = e.shiftKey ? modo !== 'si' : modo === 'si'
    setPts((p) => [...p, { x, y, si }])
  }

  const nSi = pts.filter((p) => p.si).length
  return (
    <div className="ac-knn">
      <div className="ac-campos">
        <label className="field"><span>Eje X</span><input className="input" value={ejeX} onChange={(e) => setEjeX(e.target.value)} /></label>
        <label className="field"><span>Máximo X</span><input className="input" type="number" min={1} value={xMax} onChange={(e) => setXMax(Math.max(1, Number(e.target.value) || 1))} /></label>
        <label className="field"><span>Eje Y</span><input className="input" value={ejeY} onChange={(e) => setEjeY(e.target.value)} /></label>
        <label className="field"><span>Máximo Y</span><input className="input" type="number" min={1} value={yMax} onChange={(e) => setYMax(Math.max(1, Number(e.target.value) || 1))} /></label>
      </div>
      <div className="fila">
        <span className="chico">Al hacer click agrego:</span>
        <button type="button" className={`btn btn-sm${modo === 'si' ? ' btn-primario' : ''}`} onClick={() => setModo('si')}><span className="ac-punto ac-punto-si" />Sí</button>
        <button type="button" className={`btn btn-sm${modo === 'no' ? ' btn-primario' : ''}`} onClick={() => setModo('no')}><span className="ac-punto ac-punto-no" />No</button>
        <button type="button" className={`btn btn-sm${modo === 'caso' ? ' btn-primario' : ''}`} onClick={() => setModo('caso')}>◆ Caso nuevo</button>
        <label className="chico" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>k
          <input type="range" min={1} max={Math.max(1, Math.min(15, pts.length || 1))} value={Math.min(k, Math.max(1, pts.length))} onChange={(e) => setK(Number(e.target.value))} />
          <strong>{k}</strong>
        </label>
        <label className="chico" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={normalizar} onChange={(e) => setNormalizar(e.target.checked)} />Normalizar escalas</label>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setPts(ejemplo()); setXMax(30); setYMax(30); setQuery({ x: 9, y: 8 }) }}>Sala de ejemplo</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPts((p) => p.slice(0, -1))} disabled={!pts.length}>Deshacer</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setPts([]); setQuery(null) }}>Vaciar</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onClick={click} role="img" aria-label={`Tablero KNN: ${pts.length} personas, ${nSi} sí`}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#c9cfe4" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#c9cfe4" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t} fontSize="11" fill="#5f6474">
            <text x={sx(t * xMax)} y={H - PAD + 16} textAnchor="middle">{Math.round(t * xMax)}</text>
            <text x={PAD - 8} y={sy(t * yMax) + 4} textAnchor="end">{Math.round(t * yMax)}</text>
          </g>
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#10142c">{ejeX}</text>
        <text x={12} y={H / 2} textAnchor="middle" fontSize="12" fill="#10142c" transform={`rotate(-90 12 ${H / 2})`}>{ejeY}</text>
        {query && vecinos.map((v) => (
          <line key={`l${v.i}`} x1={sx(query.x)} y1={sy(query.y)} x2={sx(pts[v.i].x)} y2={sy(pts[v.i].y)} stroke="#1d21a9" strokeDasharray="4 3" strokeWidth={1.5} />
        ))}
        {pts.map((p, i) => {
          const near = vecinos.some((v) => v.i === i)
          return <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={near ? 9 : 7} fill={p.si ? '#1d21a9' : '#ff7a1a'} stroke={near ? '#3ff0ff' : '#fff'} strokeWidth={near ? 3 : 1.5} />
        })}
        {query ? (
          <g>
            <rect x={sx(query.x) - 9} y={sy(query.y) - 9} width={18} height={18} transform={`rotate(45 ${sx(query.x)} ${sy(query.y)})`} fill="#10142c" stroke="#3ff0ff" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
      <div className="ac-knn-leyenda">
        <span><span className="ac-punto ac-punto-si" />Sí: {nSi}</span>
        <span><span className="ac-punto ac-punto-no" />No: {pts.length - nSi}</span>
        {query && decision ? (
          <strong style={{ fontSize: 18 }}>Con k = {vecinos.length}: {votosSi} sí y {vecinos.length - votosSi} no → {decision}</strong>
        ) : <span className="muted">Elegí «Caso nuevo» y hacé click en el tablero.</span>}
        {radio && !normalizar ? <span className="chico muted">Distancia al vecino más lejano: {radio.d.toFixed(1)}</span> : null}
      </div>
      <p className="chico muted" style={{ margin: 0 }}>Shift + click agrega un punto de la otra clase. Con «Normalizar» las dos variables pesan lo mismo aunque estén en escalas distintas.</p>
    </div>
  )
}
