import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow service worker to be served from root
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },
  // Compress output for faster loads
  compress: true,
  // Power-ups for faster builds
  poweredByHeader: false,
};

export default nextConfig;
