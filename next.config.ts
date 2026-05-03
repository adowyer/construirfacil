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

  experimental: {},
}

export default nextConfig
