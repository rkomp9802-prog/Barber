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

const nextConfig: NextConfig = {
  transpilePackages: ['@barber/shared'],
  images: {
    remotePatterns: storagePatterns(),
  },
}

export default nextConfig
