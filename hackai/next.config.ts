import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Servidor autocontenido en .next/standalone, que usa la imagen de Docker (Dockerfile).
  output: 'standalone',
  experimental: {
    staleTimes: { dynamic: 30 },
    // radix-ui es un paquete barril: sin esto, importar un componente de components/ui/
    // suma todos los de Radix al JavaScript del cliente de la página.
    optimizePackageImports: ['radix-ui'],
    // El material y los adjuntos del espacio de la materia pesan hasta 10 MB; el
    // resto del formulario entra en el MB que sobra. Por defecto el límite es 1 MB.
    serverActions: { bodySizeLimit: '11mb' }
  },
  // El service worker (public/sw.js) se pide sin caché HTTP: así una versión
  // nueva llega en el próximo ingreso y no a las 24 horas.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" }
        ]
      }
    ]
  }
}

export default nextConfig
