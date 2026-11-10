'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** QR en SVG (se genera en el navegador). `value` tiene que ser una URL absoluta. */
export function QrCode({ value, className, label }: { value: string; className?: string; label?: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1150', light: '#ffffff' } })
      .then((s) => { if (alive) setSvg(s) })
      .catch(() => { if (alive) setSvg(null) })
    return () => { alive = false }
  }, [value])
  return (
    <div className={`lv-qr${className ? ` ${className}` : ''}`} role="img" aria-label={label ?? `Código QR a ${value}`}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
  )
}
