/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pub-ecd37ff84be944469f0f332fdd932555.r2.dev', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
  },
  transpilePackages: ['@dineflow/types', '@dineflow/utils'],
};
module.exports = nextConfig;
