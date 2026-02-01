/**
 * Version configuration - Loaded from version.json at build time via next.config.ts
 */
export const SYSTEM_VERSION = process.env.NEXT_PUBLIC_SYSTEM_VERSION || '0.0.0';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

export const getVersionDisplay = () => {
  return `v${SYSTEM_VERSION} | Portal v${APP_VERSION}`;
};
