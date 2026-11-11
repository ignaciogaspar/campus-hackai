import type { NextConfig } from 'next'

/* Mínimo a propósito. campus/next.config.ts suma headers de seguridad y
   redirecciones de sus decks: no se copian acá porque next.config.ts es un
   archivo compartido y no viaja en el port. */
const nextConfig: NextConfig = {
  // Servidor autocontenido en .next/standalone, para la imagen de Docker.
  output: 'standalone',
}

export default nextConfig
