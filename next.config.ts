import type { NextConfig } from "next";

export const basePath =
  process.env.NODE_ENV === 'production' ? '/td-crm' : ''

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
