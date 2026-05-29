/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dineflow/types', '@dineflow/utils', '@dineflow/config'],
};
export default nextConfig;
