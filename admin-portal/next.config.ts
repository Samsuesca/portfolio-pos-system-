import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load version from version.json
const versionFile = resolve(__dirname, "../version.json");
const versionData = JSON.parse(readFileSync(versionFile, "utf-8"));

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SYSTEM_VERSION: versionData.system,
    NEXT_PUBLIC_APP_VERSION: versionData.apps.adminPortal,
  },
};

export default nextConfig;
