import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@barber/shared'],
  output: 'standalone',
}

export default nextConfig
