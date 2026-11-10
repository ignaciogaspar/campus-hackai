'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'

/** Texto seleccionado dentro del contenedor (la slide), o '' si no hay. */
export function useSelectionIn(ref: RefObject<HTMLElement | null>): [string, () => void] {
  const [text, setText] = useState('')
  useEffect(() => {
    const onChange = () => {
      const sel = window.getSelection()
      const el = ref.current
      const anchor = sel?.anchorNode ? (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement) : null
      // Solo texto de la slide (el escenario .dk-stage), nunca de controles o textareas.
      if (!sel || sel.isCollapsed || !el || !anchor || !el.contains(anchor) || !anchor.closest('.dk-stage')) {
        setText('')
        return
      }
      setText(sel.toString().replace(/\s+/g, ' ').trim())
    }
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [ref])
  const clear = useCallback(() => {
    setText('')
    window.getSelection()?.removeAllRanges()
  }, [])
  return [text, clear]
}
