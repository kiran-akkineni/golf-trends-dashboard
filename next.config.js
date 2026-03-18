/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['google-trends-api'],
  },
};

module.exports = nextConfig;