import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Leaflet pulls in image/worker assets we reference from CDN tiles only.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
