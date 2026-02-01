/**
 * Version configuration - Loaded from version.json at build time
 */
export const SYSTEM_VERSION = import.meta.env.VITE_SYSTEM_VERSION || '0.0.0';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

export const getVersionDisplay = () => {
  return `v${SYSTEM_VERSION} | App v${APP_VERSION}`;
};
