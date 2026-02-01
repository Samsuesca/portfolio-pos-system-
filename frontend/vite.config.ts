import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load version from version.json
const versionFile = resolve(__dirname, '../version.json')
const versionData = JSON.parse(readFileSync(versionFile, 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SYSTEM_VERSION': JSON.stringify(versionData.system),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(versionData.apps.frontend),
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  resolve: {
    // Priorizar .tsx/.ts sobre .js cuando existan ambos archivos
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
})
