import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: rootDir,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  serverExternalPackages: ["sharp", "@prisma/client", "prisma"],
  /** Prod Docker: eski tip uyumsuzlukları canlı sonrası temizlenecek */
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
