import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Servidor autocontenido en .next/standalone, que usa la imagen de Docker (Dockerfile).
  output: 'standalone',
}

export default nextConfig
