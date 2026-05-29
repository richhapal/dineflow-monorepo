/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 — Public Development URL
      {
        protocol: 'https',
        hostname: 'pub-ecd37ff84be944469f0f332fdd932555.r2.dev',
        pathname: '/**',
      },
      // Cloudinary — legacy items still in DB
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['@dineflow/types', '@dineflow/utils', '@dineflow/config'],
};

module.exports = nextConfig;
