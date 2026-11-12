'use client'

import { useEffect } from 'react'

/* Registra public/sw.js, que muestra /sin-conexion cuando no hay red. Solo en
   producción: en `npm run dev` guardaría lo estático en caché y taparía los
   cambios. No dibuja nada. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Sin service worker la app anda igual; solo falta la pantalla sin conexión.
    })
  }, [])

  return null
}
