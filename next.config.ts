import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' } // for CSV uploads if we add admin later
  }
}

export default nextConfig
