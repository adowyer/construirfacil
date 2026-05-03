import type { NextConfig } from 'next'
import os from 'node:os'
import path from 'node:path'

// El proyecto vive en ~/Documents que está sincronizado con iCloud.
// Si dejamos `.next/` ahí, iCloud renombra/sincroniza archivos mientras
// Next está escribiéndolos y se rompe el dev server con errores ENOENT.
// Movemos el directorio de build fuera de Documents para evitarlo.
const distDir = path.join(os.homedir(), '.cache', 'next-construirfacil')

const nextConfig: NextConfig = {
  distDir,

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

  experimental: {},
}

export default nextConfig
