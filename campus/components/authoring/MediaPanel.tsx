'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { confirmMediaUploadAction, listDeckMediaAction, requestMediaUploadAction } from '@/app/profesor/decks/media-actions'
import { browserSupabase } from '@/lib/realtime-client'
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, mediaSnippet, mediaType } from '@/lib/media/core'
import type { MediaAsset } from '@/lib/media/core'

export interface MediaPanelProps {
  deckId: string
  /** La slide abierta es 'iae' (HTML): el fragmento que se inserta va en HTML, si no en Markdown. */
  html: boolean
  /** Sin slide abierta no se puede insertar, solo subir y copiar. */
  onInsert?: (snippet: string) => void
  onClose: () => void
}

const peso = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** Modal "Media del deck": sube imágenes, videos, audio o PDF al bucket y los inserta en la slide. */
export function MediaPanel({ deckId, html, onInsert, onClose }: MediaPanelProps) {
  const [assets, setAssets] = useState<MediaAsset[] | null>(null)
  const [uploading, setUploading] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void listDeckMediaAction(deckId).then((res) => (res.ok ? setAssets(res.assets) : setError(res.error)))
  }, [deckId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const upload = useCallback(async (file: File) => {
    if (!mediaType(file.name)) throw new Error(`«${file.name}»: formato no admitido`)
    if (file.size > MEDIA_MAX_BYTES) throw new Error(`«${file.name}» pesa más de 50 MB`)
    const req = await requestMediaUploadAction({ deckId, filename: file.name, size: file.size })
    if (!req.ok) throw new Error(req.error)
    const { error: upErr } = await browserSupabase().storage.from(MEDIA_BUCKET).uploadToSignedUrl(req.path, req.token, file, { contentType: req.contentType })
    if (upErr) throw new Error(`«${file.name}»: ${upErr.message}`)
    const done = await confirmMediaUploadAction({ deckId, path: req.path, filename: file.name })
    if (!done.ok) throw new Error(done.error)
    return done.asset
  }, [deckId])

  async function onFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setError(null)
    setUploading((cur) => [...cur, ...list.map((f) => f.name)])
    const errors: string[] = []
    for (const f of list) {
      try {
        const asset = await upload(f)
        setAssets((cur) => [asset, ...(cur ?? [])])
      } catch (err) {
        errors.push((err as Error).message)
      } finally {
        setUploading((cur) => { const i = cur.indexOf(f.name); return i < 0 ? cur : [...cur.slice(0, i), ...cur.slice(i + 1)] })
      }
    }
    if (errors.length) setError(errors.join(' · '))
    if (input.current) input.current.value = ''
  }

  async function copy(a: MediaAsset) {
    await navigator.clipboard.writeText(a.url)
    setCopied(a.id)
    setTimeout(() => setCopied((c) => (c === a.id ? null : c)), 1500)
  }

  return (
    <div className="au-modal-fondo" role="dialog" aria-modal="true" aria-label="Media del deck" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="au-modal">
        <div className="au-modal-head">
          <h2>Media del deck</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
        </div>
        <div className="au-modal-body">
          <div className={`au-media-drop${drag ? ' on' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void onFiles(e.dataTransfer.files) }}>
            <p>Arrastrá archivos acá o <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>elegilos</button></p>
            <p className="chico muted">Imágenes, mp4, webm, mp3, m4a, wav o pdf. Hasta 50 MB cada uno. Quedan públicos: se ven en el proyector y en el celular de los alumnos.</p>
            <input ref={input} type="file" multiple hidden accept="image/*,video/mp4,video/webm,audio/*,application/pdf"
              onChange={(e) => e.target.files && void onFiles(e.target.files)} />
          </div>

          {uploading.length ? <div className="alerta chico">Subiendo {uploading.join(', ')}…</div> : null}
          {error ? <div className="alerta alerta-error chico">{error}</div> : null}

          {assets === null ? <p className="chico muted">Cargando…</p> : null}
          {assets?.length === 0 ? <p className="chico muted">Este deck todavía no tiene media.</p> : null}
          {assets?.length ? (
            <div className="au-media-grid">
              {assets.map((a) => (
                <div key={a.id} className="au-media-item">
                  <div className="au-media-thumb">
                    {a.kind === 'image' ? <img src={a.url} alt={a.filename} loading="lazy" />
                      : a.kind === 'video' ? <video src={a.url} preload="metadata" muted />
                        : <span className="au-chip">{a.kind}</span>}
                  </div>
                  <div className="au-media-name" title={a.filename}>{a.filename}</div>
                  <div className="chico muted">{peso(a.sizeBytes)}</div>
                  <div className="au-media-actions">
                    {onInsert ? <button type="button" className="btn btn-sm btn-primario" onClick={() => onInsert(mediaSnippet(a, html))}>Insertar</button> : null}
                    <button type="button" className="btn btn-sm" onClick={() => void copy(a)}>{copied === a.id ? 'Copiada' : 'Copiar URL'}</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
