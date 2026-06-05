import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load version from version.json (ESM-compatible __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirnameSafe = dirname(__filename);
const versionFile = resolve(__dirnameSafe, "../version.json");
const versionData = JSON.parse(readFileSync(versionFile, "utf-8"));

const slugRedirects: Array<{ source: string; destination: string }> = [
  { source: '/instituci-n-educativa-caracas', destination: '/institucion-educativa-caracas' },
  { source: '/instituci-n-educativa-alfonso-l-pez-pumarejo', destination: '/institucion-educativa-alfonso-lopez-pumarejo' },
  { source: '/instituci-n-educativa-el-pinal', destination: '/institucion-educativa-el-pinal' },
  { source: '/buen-comiezo', destination: '/buen-comienzo' },
  { source: '/institucion-educativa-hector-abad-gomes', destination: '/institucion-educativa-hector-abad-gomez' },
  { source: '/confama', destination: '/comfama' },
];

const nextConfig: NextConfig = {
  async redirects() {
    return slugRedirects.map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  env: {
    NEXT_PUBLIC_SYSTEM_VERSION: versionData.system,
    NEXT_PUBLIC_APP_VERSION: versionData.apps.webPortal,
  },
  images: {
    // Next.js 15 bloquea por defecto fetches a IPs privadas (SSRF protection).
    // En dev, el backend corre en localhost (127.0.0.1) — desactivar optimizacion
    // evita el error "upstream image resolved to private ip" sin abrir SSRF en prod.
    unoptimized: process.env.NODE_ENV === 'development',
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
