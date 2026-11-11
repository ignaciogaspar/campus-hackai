import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Servidor autocontenido en .next/standalone, que usa la imagen de Docker (Dockerfile).
  output: 'standalone',
  // radix-ui es un paquete barril: sin esto, importar un componente de components/ui/
  // suma todos los de Radix al JavaScript del cliente de la página.
  experimental: { optimizePackageImports: ['radix-ui'] },
}

export default nextConfig
