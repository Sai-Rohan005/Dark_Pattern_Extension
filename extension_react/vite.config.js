import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const backendUrl = loadEnv(mode, projectRoot, 'backend_url').backend_url?.trim()

  if (!backendUrl) {
    throw new Error('Set backend_url in extension_react/.env before starting or building the app.')
  }

  const parsedBackendUrl = new URL(backendUrl)
  if (!['http:', 'https:'].includes(parsedBackendUrl.protocol)) {
    throw new Error('backend_url must use http:// or https://.')
  }

  return {
    base: './',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
    },
    build: {
      outDir: resolve(projectRoot, 'dist'),
      rollupOptions: {
        input: {
          'src/popup/popup': resolve(projectRoot, 'src/popup/popup.html'),
          'src/sidepanel/index': resolve(projectRoot, 'src/sidepanel/index.html'),
        },
      },
    },
  }
})
