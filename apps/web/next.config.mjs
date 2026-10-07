/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces the minimal self-contained server copied by Dockerfile.prod.
  output: 'standalone',
};

export default nextConfig;
