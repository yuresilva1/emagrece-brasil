import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Necessário para pdf-parse funcionar no Next.js (usa fs do Node)
  serverExternalPackages: ['pdf-parse'],

  // Permite imagens do Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Headers de segurança básicos
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}

export default nextConfig
