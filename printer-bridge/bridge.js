#!/usr/bin/env node
// Print bridge for the Kitchen Display System's "Network Printer (IP
// address)" option — see src/lib/networkPrinter.js for why this exists:
// a browser can't open a raw TCP socket, and a page served over https
// can't fetch() a plain http:// URL. This tiny standalone program (no
// npm install needed — only Node's own built-in modules) runs on a
// computer on the same network as the printer, accepts an HTTP request
// from the KDS app, and relays the raw bytes to the printer's own
// network port (almost always TCP 9100, sometimes called "JetDirect" or
// "raw" printing).
//
// Usage (one printer):
//   node bridge.js --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008
//
// Usage (several printers behind one bridge process — see README.md's
// "Multiple printers" section):
//   node bridge.js --listen-port 8008 \
//     --printer kitchen1=192.168.1.30:9100 --printer kitchen2=192.168.1.32:9100
//
// Environment variables work the same way (PRINTER_HOST, PRINTER_PORT,
// LISTEN_PORT) as the single-printer flags, if you'd rather not pass
// flags — there's no env-var form of the repeatable --printer flag.
//
// Endpoints:
//   GET  /status        -> 200 "ok" as soon as the bridge itself is up
//                           (does NOT check any printer — used by the KDS
//                           app's "Connect" button, which shouldn't waste
//                           paper)
//   GET  /printers       -> 200 JSON {"printers": ["kitchen1", "kitchen2"]}
//                           — lets the KDS app offer these as suggestions
//                           instead of making someone type a name by hand.
//   POST /print           -> relays the request body, byte for byte, to
//                           the single configured printer's TCP port
//                           (or the one named "default" — see README.md).
//   POST /print/<name>    -> same, but to the printer registered under
//                           <name> when this bridge relays to several.
//
// HTTPS: this app is almost certainly loaded over https, and an https
// page cannot fetch() a plain http:// URL — Chrome blocks it as "mixed
// content" no matter how local the target IP is. So run this WITH
// --cert/--key (see README.md in this folder for how to generate a free
// self-signed certificate in two commands) unless the KDS app itself is
// being served over plain http on your local network.
'use strict'

const http = require('http')
const https = require('https')
const net = require('net')
const fs = require('fs')

// Repeated flags (e.g. multiple `--printer name=host:port`) collect into
// an array instead of the later one silently overwriting the earlier one.
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      let value
      if (next !== undefined && !next.startsWith('--')) {
        value = next
        i++
      } else {
        value = true
      }
      if (out[key] === undefined) {
        out[key] = value
      } else if (Array.isArray(out[key])) {
        out[key].push(value)
      } else {
        out[key] = [out[key], value]
      }
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

const LISTEN_PORT = Number(args['listen-port'] || process.env.LISTEN_PORT || 8008)
const CERT_PATH = args.cert || process.env.BRIDGE_CERT
const KEY_PATH = args.key || process.env.BRIDGE_KEY
// Loosen or tighten as needed — '*' is simplest to get working first,
// but you can set this to the exact origin your KDS app is served from
// (e.g. https://kds-omega.vercel.app) once things work, so only that
// site's pages can POST tickets to this bridge.
const ALLOW_ORIGIN = args['allow-origin'] || process.env.ALLOW_ORIGIN || '*'

// name -> { host, port }. Populated below from either the legacy single-
// printer flags (registered as "default", so old setups and old saved
// KDS profiles keep working unchanged) or one-or-more --printer flags.
const PRINTERS = new Map()

function addPrinter(name, host, port) {
  if (!name || !host) return
  PRINTERS.set(name, { host, port: Number(port) || 9100 })
}

const legacyHost = args['printer-host'] || process.env.PRINTER_HOST
if (legacyHost) {
  addPrinter('default', legacyHost, args['printer-port'] || process.env.PRINTER_PORT)
}

for (const spec of [].concat(args.printer || [])) {
  if (typeof spec !== 'string') continue
  const eq = spec.indexOf('=')
  if (eq === -1) {
    console.error(`Ignoring malformed --printer "${spec}" — expected name=host:port`)
    continue
  }
  const name = spec.slice(0, eq).trim()
  const target = spec.slice(eq + 1).trim()
  const colon = target.lastIndexOf(':')
  const host = colon === -1 ? target : target.slice(0, colon)
  const port = colon === -1 ? undefined : target.slice(colon + 1)
  addPrinter(name, host, port)
}

if (PRINTERS.size === 0) {
  console.error('No printers configured. Use either:')
  console.error('  --printer-host 192.168.1.20 --printer-port 9100   (one printer)')
  console.error('  --printer kitchen1=192.168.1.30:9100 --printer kitchen2=192.168.1.32:9100   (several, one bridge)')
  process.exit(1)
}

// Resolves which printer a request meant: the explicitly named one, or —
// when no name was given — the single configured printer (whatever it's
// called) or the one named "default", so a request with no name still
// works for anyone running this the original, single-printer way.
function resolvePrinter(name) {
  if (name) return PRINTERS.get(name) || null
  if (PRINTERS.size === 1) return PRINTERS.values().next().value
  return PRINTERS.get('default') || null
}

function relayToPrinter(target, bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: target.host, port: target.port }, () => {
      socket.end(bytes)
    })
    socket.setTimeout(8000, () => socket.destroy(new Error('Timed out connecting to the printer')))
    socket.on('close', () => resolve())
    socket.on('error', reject)
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, 'http://bridge.local')

  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (req.method === 'GET' && url.pathname === '/printers') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ printers: [...PRINTERS.keys()] }))
    return
  }

  if (req.method === 'POST' && (url.pathname === '/print' || url.pathname.startsWith('/print/'))) {
    const nameFromPath = url.pathname === '/print' ? null : decodeURIComponent(url.pathname.slice('/print/'.length))
    const name = nameFromPath || url.searchParams.get('printer') || null
    const target = resolvePrinter(name)
    if (!target) {
      const configured = [...PRINTERS.keys()].join(', ') || '(none)'
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end(
        name
          ? `No printer named "${name}" is configured on this bridge. Configured: ${configured}`
          : `This bridge has ${PRINTERS.size} printers configured — specify which one with /print/<name>. Configured: ${configured}`,
      )
      return
    }
    try {
      const bytes = await readBody(req)
      await relayToPrinter(target, bytes)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('printed')
    } catch (err) {
      console.error('Print relay failed:', err.message)
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end(`Could not reach the printer at ${target.host}:${target.port}: ${err.message}`)
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end(
    'Not found — POST bytes to /print (or /print/<name> with multiple printers), GET /status to check ' +
      'the bridge is up, or GET /printers to list configured printers.',
  )
}

let server
if (CERT_PATH && KEY_PATH) {
  server = https.createServer({ cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) }, handler)
} else {
  server = http.createServer(handler)
}

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

server.listen(LISTEN_PORT, () => {
  const scheme = CERT_PATH ? 'https' : 'http'
  console.log(`Print bridge listening on ${scheme}://0.0.0.0:${LISTEN_PORT}`)
  const list = [...PRINTERS.entries()].map(([name, t]) => `${name} -> ${t.host}:${t.port}`).join(', ')
  console.log(PRINTERS.size > 1 ? `Printers configured: ${list}` : `Relaying to printer: ${list}`)
  if (!CERT_PATH) {
    console.log(
      'No --cert/--key given: running plain http. A KDS app loaded over https will NOT be able to ' +
        'reach this bridge at all (blocked as mixed content) — see README.md.',
    )
  }
})
