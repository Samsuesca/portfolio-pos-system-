import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load version from version.json (ESM-compatible __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirnameSafe = dirname(__filename);
const versionFile = resolve(__dirnameSafe, "../version.json");
const versionData = JSON.parse(readFileSync(versionFile, "utf-8"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SYSTEM_VERSION: versionData.system,
    NEXT_PUBLIC_APP_VERSION: versionData.apps.webPortal,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.yourdomain.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8001',
        pathname: '/uploads/**',
      },
    ],
    // Optimización automática para diferentes tamaños de dispositivo
    deviceSizes: [320, 420, 640, 768, 1024, 1280],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};

export default nextConfig;
