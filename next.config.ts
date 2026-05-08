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

  experimental: {},
}

export default nextConfig
