import { routes } from './handlers.js'

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function toWebRequest(req) {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? await readBody(req) : undefined,
  })
}

/**
 * Runs a /api route on a Node http request. Returns false when the path is not an
 * API route, so the caller can serve the SPA instead.
 */
export async function handleApi(req, res, env) {
  const { pathname } = new URL(req.url, 'http://localhost')
  const handler = routes[`${req.method} ${pathname}`]
  if (!handler) return false
  const response = await handler(await toWebRequest(req), env)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
  return true
}
