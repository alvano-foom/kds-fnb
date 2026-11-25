import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi } from './server/nodeAdapter.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Serves the server/ /api routes from `vite` and `vite preview`, so local dev needs no
 * separate backend. Server env is read from the same .env files, but only VITE_ values
 * ever reach the browser bundle.
 */
function kdsServerApi() {
  let env = {}
  const middleware = async (req, res, next) => {
    try {
      if (!(await handleApi(req, res, env))) next()
    } catch (err) {
      next(err)
    }
  }
  return {
    name: 'kds-server-api',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...process.env }
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), kdsServerApi()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})
