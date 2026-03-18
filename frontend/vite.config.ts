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
    port: 5171,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-state': ['zustand', '@tanstack/react-query', 'axios'],
          'vendor-pdf': ['jspdf'],
          'vendor-icons': ['lucide-react'],
          'vendor-tauri': [
            '@tauri-apps/api',
            '@tauri-apps/plugin-dialog',
            '@tauri-apps/plugin-fs',
            '@tauri-apps/plugin-http',
            '@tauri-apps/plugin-shell',
          ],
        },
      },
    },
  },
  resolve: {
    // Priorizar .tsx/.ts sobre .js cuando existan ambos archivos
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
})
