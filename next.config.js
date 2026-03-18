/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['undici', 'https-proxy-agent'],
  },
};

module.exports = nextConfig;