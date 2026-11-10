'use client'

/* ============================================================
   IaeStage: una slide 'iae' (estilo de los decks de Ignacio) a
   1280×720, dentro de un Shadow DOM con el CSS empaquetado
   (lib/iae/css.generated.ts = deck.css + <style> de ref_index +
   extra.css + lib/iae/styles/campus.css). El escalado lo hace
   SlideView (dk-stage), igual que con el resto de las slides.

   - El HTML se sanitiza (lib/iae/sanitize) y las rutas relativas
     se resuelven contra /decks/empresas-familiares/.
   - Videos: muted + loop + playsinline; se reproducen solo cuando
     la slide está visible (IntersectionObserver). Con media=false
     (miniaturas, biblioteca) quedan quietos en el poster.
   - Audio (<audio>): suena solo con audio=true (la pantalla de la
     clase en vivo y la vista previa del editor), con loop, mientras la
     slide está visible. En los celulares y las miniaturas queda en silencio.
   - `children`: el componente vivo de una slide interactiva; entra
     por el <slot> del cuerpo (light DOM, con el CSS del campus).
   ============================================================ */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { IAE_CSS } from '@/lib/iae/css.generated'
import { IAE_FONTS_HREF, IAE_STAGE, iaeStageHtml } from '@/lib/iae/markup'
import type { IaeParts } from '@/lib/iae/markup'
import { IAE_MEDIA_BASE, sanitizeIaeHtml } from '@/lib/iae/sanitize'
import './iae.css'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

let sharedSheet: CSSStyleSheet | null | undefined

/** Una sola hoja compartida por todas las sombras (adoptedStyleSheets). */
function iaeSheet(): CSSStyleSheet | null {
  if (sharedSheet !== undefined) return sharedSheet
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(IAE_CSS)
    sharedSheet = sheet
  } catch {
    sharedSheet = null
  }
  return sharedSheet
}

/** Las fuentes se declaran en el documento: @font-face no funciona dentro de una sombra. */
function ensureFonts() {
  if (typeof document === 'undefined' || document.getElementById('iae-fonts')) return
  const link = document.createElement('link')
  link.id = 'iae-fonts'
  link.rel = 'stylesheet'
  link.href = IAE_FONTS_HREF
  document.head.appendChild(link)
}

export interface IaeStageProps {
  parts: IaeParts
  /** 0-based: muestra el contador como en el deck original. */
  index?: number
  /** Carpeta de media relativa (default /decks/empresas-familiares/). */
  base?: string
  /** false: los videos no se reproducen (miniaturas). */
  media?: boolean
  /** true: los <audio> suenan mientras la slide está visible (proyector y vista previa del editor). */
  audio?: boolean
  /** Componente vivo para el <slot> (slides interactivas). */
  children?: ReactNode
}

export function IaeStage({ parts, index, base = IAE_MEDIA_BASE, media = true, audio = false, children }: IaeStageProps) {
  const host = useRef<HTMLDivElement>(null)
  const markup = useMemo(() => {
    const { html } = sanitizeIaeHtml(parts.html, { base })
    return iaeStageHtml({ classes: parts.classes, html }, { index, trusted: true })
  }, [parts.classes, parts.html, base, index])

  useIsoLayoutEffect(() => {
    const el = host.current
    if (!el) return
    ensureFonts()
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    const sheet = iaeSheet()
    if (sheet && 'adoptedStyleSheets' in root) {
      if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [sheet]
      root.innerHTML = markup
    } else {
      root.innerHTML = `<style>${IAE_CSS}</style>${markup}`
    }
    root.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => img.classList.add('iae-missing'), { once: true })
    })
    const audios = Array.from(root.querySelectorAll('audio'))
    for (const a of audios) {
      a.autoplay = false
      a.removeAttribute('autoplay')
      a.loop = true
      a.preload = audio ? 'auto' : 'none'
    }
    let stopAudio = () => {}
    // Botón de arranque (.audio-start): la slide espera el clic en vez de arrancar sola.
    // Fuera del proyector y del editor (audio=false) no se muestra.
    const starter = root.querySelector<HTMLElement>('.audio-start')
    if (starter && (!audio || !audios.length)) starter.remove()
    if (audio && audios.length) {
      let visible = false
      let armed = !starter
      // Si el navegador bloquea el autoplay con sonido (nadie tocó la página todavía),
      // aparece un botón en la slide; también arranca con el primer clic o tecla.
      let unlock: HTMLButtonElement | null = null
      const hideUnlock = () => { unlock?.remove(); unlock = null }
      const showUnlock = () => {
        if (unlock || !visible) return
        unlock = document.createElement('button')
        unlock.type = 'button'
        unlock.textContent = '🔊 Activar sonido'
        unlock.setAttribute('style', 'position:absolute;right:40px;bottom:40px;z-index:50;padding:14px 22px;border:0;border-radius:999px;background:#FF7A1A;color:#fff;font:700 22px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.3)')
        unlock.addEventListener('click', () => playAudio())
        ;(root.querySelector(".slide") ?? root).appendChild(unlock)
      }
      const playAudio = () => {
        if (!visible || !armed) return
        for (const a of audios) {
          void a.play().then(hideUnlock).catch((err: unknown) => {
            if ((err as { name?: string })?.name === 'NotAllowedError') showUnlock()
          })
        }
      }
      // Si el navegador bloquea el autoplay con sonido, arranca con el primer clic o tecla.
      const onGesture = () => playAudio()
      window.addEventListener('pointerdown', onGesture)
      window.addEventListener('keydown', onGesture)
      starter?.addEventListener('click', () => {
        armed = true
        starter.classList.add('is-off')
        for (const a of audios) { try { a.currentTime = 0 } catch {} }
        playAudio()
      })
      const aio = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1]
        const was = visible
        visible = Boolean(e?.isIntersecting && e.intersectionRatio >= 0.5)
        // Cada vez que la slide aparece, el audio (y las animaciones sincronizadas) arrancan de 0.
        if (visible && !was) for (const a of audios) { try { a.currentTime = 0 } catch {} }
        if (visible) playAudio()
        else {
          hideUnlock()
          for (const a of audios) a.pause()
          // al volver a la slide, otra vez el botón de arranque
          if (starter) { armed = false; starter.classList.remove('is-off') }
        }
      }, { threshold: [0, 0.5, 1] })
      aio.observe(el)
      // Animaciones CSS de la slide sincronizadas con el primer <audio>: arrancan con la
      // música, se pausan con ella y se corrigen si se desfasan (incluido el loop).
      const master = audios[0]
      const anims = () => ('getAnimations' in root ? (root as ShadowRoot & { getAnimations(): Animation[] }).getAnimations() : [])
      const sync = (force = false) => {
        const t = master.currentTime * 1000
        for (const an of anims()) {
          const cur = Number(an.currentTime ?? 0)
          if (force || Math.abs(cur - t) > 300) an.currentTime = t
          if (master.paused) an.pause()
          else if (an.playState !== 'running' && an.playState !== 'finished') an.play()
        }
      }
      const onPlaying = () => sync(true)
      const onPause = () => sync(true)
      const onTime = () => sync(false)
      master.addEventListener('playing', onPlaying)
      master.addEventListener('pause', onPause)
      master.addEventListener('seeked', onPlaying)
      master.addEventListener('timeupdate', onTime)
      stopAudio = () => {
        master.removeEventListener('playing', onPlaying)
        master.removeEventListener('pause', onPause)
        master.removeEventListener('seeked', onPlaying)
        master.removeEventListener('timeupdate', onTime)
        aio.disconnect()
        window.removeEventListener('pointerdown', onGesture)
        window.removeEventListener('keydown', onGesture)
        hideUnlock()
        for (const a of audios) a.pause()
      }
    }
    const videos = Array.from(root.querySelectorAll('video'))
    for (const v of videos) {
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.autoplay = false
      v.removeAttribute('autoplay')
      if (!media) v.preload = 'none'
    }
    if (!media || videos.length === 0) return stopAudio
    const play = (on: boolean) => {
      for (const v of videos) {
        if (on) void v.play().catch(() => {})
        else {
          v.pause()
          try { v.currentTime = 0 } catch {}
        }
      }
    }
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]
      play(Boolean(e?.isIntersecting && e.intersectionRatio >= 0.5))
    }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => {
      io.disconnect()
      play(false)
      stopAudio()
    }
  }, [markup, media, audio])

  return (
    <div ref={host} className="iae-host" style={{ width: IAE_STAGE.width, height: IAE_STAGE.height }}>
      {children ? <div className="c-deck iae-slot">{children}</div> : null}
    </div>
  )
}

export default IaeStage
