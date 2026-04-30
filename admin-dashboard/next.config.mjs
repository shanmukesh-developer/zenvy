/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
