/// <reference types="vitest" />

import { createRequire } from 'node:module'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const requireConfigModule = createRequire(import.meta.url)
const envDir = path.resolve(__dirname, '..')

type ConfigCore = {
  loadConfig(options?: {
    applyToProcessEnv?: boolean
    overrideProcessEnv?: boolean
  }): {
    config: {
      backend: {
        url: string
      }
      frontend: {
        host: string
        port: number
      }
    }
  }
}

const configCore = requireConfigModule(
  path.resolve(__dirname, '../scripts/config/config-core.cjs'),
) as ConfigCore

// https://vite.dev/config/
export default defineConfig(() => {
  const { config } = configCore.loadConfig({
    applyToProcessEnv: true,
    overrideProcessEnv: true,
  })
  const apiProxy = {
    '/api': {
      target: config.backend.url,
      changeOrigin: true,
    },
  }

  return {
    envDir,
    plugins: [react()],
    preview: {
      host: config.frontend.host,
      port: config.frontend.port,
      proxy: apiProxy,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/test-setup.ts'],
    },
    server: {
      host: config.frontend.host,
      port: config.frontend.port,
      proxy: apiProxy,
    },
  }
})
