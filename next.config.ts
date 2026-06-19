import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow images from Supabase Storage to be used in next/image
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Oculta el dev indicator/logo de Next.js que aparece en dev mode.
  devIndicators: false,

  experimental: {
    // Server Actions: el default es 1MB (muy bajo para subir imágenes/gifs
    // de banners/slides desde el admin). 8MB da margen sin habilitar abuso.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },

  async rewrites() {
    return [
      // Legacy URL del lab (cuando era HTML estático con Botpress) → page Next.
      // Rewrite, no redirect: la URL queda en la barra, no rompe links externos.
      { source: '/ximia-lab.html', destination: '/ximia-lab' },
    ]
  },
}

export default nextConfig
