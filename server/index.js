/**
 * Self-hosted server: serves the built app (dist/) and the /api routes.
 *   npm run build:staging && npm start
 * Env comes from the process (e.g. `node --env-file=.env.server server/index.js`,
 * systemd, Docker). See README "Server-side env".
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi } from './nodeAdapter.js'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const INDEX = path.join(DIST, 'index.html')
const PORT = Number(process.env.PORT) || 3000

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function resolveFile(urlPath) {
  try {
    const file = path.join(DIST, decodeURIComponent(urlPath))
    // Outside dist/ (path traversal) or not a file -> SPA fallback.
    if (file.startsWith(DIST + path.sep) && fs.statSync(file).isFile()) return file
  } catch {
    // missing file or malformed URL
  }
  return INDEX
}

if (!fs.existsSync(INDEX)) {
  console.error(`dist/ not found at ${DIST}. Run "npm run build" (or build:staging) first.`)
  process.exit(1)
}

http
  .createServer(async (req, res) => {
    try {
      if (await handleApi(req, res, process.env)) return
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end()
        return
      }
      const file = resolveFile(new URL(req.url, 'http://localhost').pathname)
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
        // Hashed assets never change; index.html must always be fresh.
        'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      if (req.method === 'HEAD') res.end()
      else fs.createReadStream(file).pipe(res)
    } catch (err) {
      console.error('[kds-server]', err)
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'server_error', message: 'Unexpected server error.' } }))
    }
  })
  .listen(PORT, () => console.log(`KDS listening on http://localhost:${PORT}`))
