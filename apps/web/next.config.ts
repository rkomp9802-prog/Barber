import type { NextConfig } from 'next'

import { STORAGE_PUBLIC_PATH, storageHost } from './src/lib/images'

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number]

/** Разрешаем next/image только публичные файлы нашего Supabase Storage. */
function storagePatterns(): RemotePattern[] {
  const host = storageHost(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!host) return []
  return [
    {
      protocol: host.protocol === 'http:' ? 'http' : 'https',
      hostname: host.hostname,
      port: host.port,
      pathname: `${STORAGE_PUBLIC_PATH}**`,
    },
  ]
}

/**
 * В продакшене браузер ходит в API через сайт (/api/v1 → API_URL): так cookie сессии админки
 * остаётся своей для домена сайта, а не сторонней (Safari и др. блокируют сторонние cookie).
 * Для этого NEXT_PUBLIC_API_URL = адрес самого сайта, API_URL = адрес API.
 */
async function apiRewrites() {
  const target = process.env.API_URL?.trim().replace(/\/+$/, '')
  if (!target) return []
  return [{ source: '/api/v1/:path*', destination: `${target}/api/v1/:path*` }]
}

/** Базовые защитные заголовки: сайт (и админку) нельзя встроить в чужой iframe. */
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  transpilePackages: ['@barber/shared'],
  poweredByHeader: false,
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  images: {
    remotePatterns: storagePatterns(),
  },
  rewrites: apiRewrites,
}

export default nextConfig
