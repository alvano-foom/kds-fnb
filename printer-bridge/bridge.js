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
// Usage:
//   node bridge.js --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008
//
// Environment variables work the same way (PRINTER_HOST, PRINTER_PORT,
// LISTEN_PORT) if you'd rather not pass flags.
//
// Endpoints:
//   GET  /status  -> 200 "ok" as soon as the bridge itself is up (does
//                    NOT check the printer — used by the KDS app's
//                    "Connect" button, which shouldn't waste paper)
//   POST /print   -> relays the request body, byte for byte, to the
//                    printer's TCP port, then closes that connection.
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

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = true
      }
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

const PRINTER_HOST = args['printer-host'] || process.env.PRINTER_HOST
const PRINTER_PORT = Number(args['printer-port'] || process.env.PRINTER_PORT || 9100)
const LISTEN_PORT = Number(args['listen-port'] || process.env.LISTEN_PORT || 8008)
const CERT_PATH = args.cert || process.env.BRIDGE_CERT
const KEY_PATH = args.key || process.env.BRIDGE_KEY
// Loosen or tighten as needed — '*' is simplest to get working first,
// but you can set this to the exact origin your KDS app is served from
// (e.g. https://kds-omega.vercel.app) once things work, so only that
// site's pages can POST tickets to this bridge.
const ALLOW_ORIGIN = args['allow-origin'] || process.env.ALLOW_ORIGIN || '*'

if (!PRINTER_HOST) {
  console.error('Missing --printer-host (or PRINTER_HOST env var). Example:')
  console.error('  node bridge.js --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008')
  process.exit(1)
}

function relayToPrinter(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: PRINTER_HOST, port: PRINTER_PORT }, () => {
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

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (req.method === 'POST' && req.url === '/print') {
    try {
      const bytes = await readBody(req)
      await relayToPrinter(bytes)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('printed')
    } catch (err) {
      console.error('Print relay failed:', err.message)
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end(`Could not reach the printer at ${PRINTER_HOST}:${PRINTER_PORT}: ${err.message}`)
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found — POST bytes to /print, or GET /status to check the bridge is up.')
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
  console.log(`Relaying to printer at ${PRINTER_HOST}:${PRINTER_PORT}`)
  if (!CERT_PATH) {
    console.log(
      'No --cert/--key given: running plain http. A KDS app loaded over https will NOT be able to ' +
        'reach this bridge at all (blocked as mixed content) — see README.md.',
    )
  }
})
