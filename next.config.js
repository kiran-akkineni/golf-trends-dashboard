/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['https-proxy-agent'],
  },
};

module.exports = nextConfig;
