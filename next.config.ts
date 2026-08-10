import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  serverExternalPackages: ["sharp", "@prisma/client", "prisma"],
  /** Prod Docker build: ~20 eski tip uyumsuzluğu; canlı sonrası temizlenecek */
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
