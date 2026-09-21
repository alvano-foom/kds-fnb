# Print bridge — for the KDS "Network Printer (IP address)" option

## Why this exists

The KDS app's Settings → Receipt Printer now has a "Network Printer (IP
address)" option alongside Bluetooth. It can't talk to a network printer
by itself, for two unavoidable reasons:

1. **Browsers can't open a raw TCP socket.** Network ESC/POS printers
   (and basically every "JetDirect" / raw-socket network printer) expect
   bytes on a raw TCP port — almost always **9100**. There is no browser
   API, on any page, that can connect to a TCP port directly. This is the
   same kind of hard platform boundary as Web Bluetooth only reaching
   BLE devices, not classic Bluetooth.
2. **The KDS app is served over https**, and a page loaded over https
   cannot `fetch()` a plain `http://` URL — Chrome blocks it outright as
   "mixed content," no matter how local the target IP is.

`bridge.js` in this folder solves both: it's a tiny program that runs on
a computer on the same network as the printer, accepts an HTTP(S)
request from the KDS app, and relays the bytes to the printer's TCP port.

## What you need

- A computer that's always on and on the same network as the printer —
  a spare PC, a Raspberry Pi, or even the same machine the KDS tablet
  talks to. It needs [Node.js](https://nodejs.org) installed (any
  reasonably recent version) — nothing else, no `npm install` required.
- The printer's IP address and raw print port (check the printer's own
  network settings page or its manual — port **9100** is the default for
  the vast majority of network thermal/label printers).

## Quick start (same network, no HTTPS)

If the KDS app is ever loaded over plain `http://` on your local network
(not the case for a Vercel deployment, but true if you're running it
locally), you can skip straight to:

```bash
node bridge.js --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008
```

Then in the KDS app's Settings → Receipt Printer → Network Printer, enter
the bridge computer's own IP address and port `8008`, leave "Bridge uses
HTTPS" unchecked, and click Connect.

## The usual case: KDS app is on https (e.g. Vercel)

You need the bridge to serve https too, with a certificate. A free
self-signed one is enough — you just have to tell your browser to trust
it once.

1. Generate a self-signed certificate (valid ~10 years) — run this on
   the bridge computer:

   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 3650 \
     -subj "/CN=kds-print-bridge"
   ```

   This creates `cert.pem` and `key.pem` next to `bridge.js`.

2. Start the bridge with them:

   ```bash
   node bridge.js --printer-host 192.168.1.20 --printer-port 9100 \
     --listen-port 8008 --cert cert.pem --key key.pem
   ```

3. **On every device that will use the KDS app** (each kitchen tablet,
   each browser), open `https://<bridge-ip>:8008/status` once and click
   through the "your connection isn't private" warning to accept the
   certificate. You should see the page just say `ok`. This one-time
   step is what lets the KDS app's own `fetch()` calls to that address
   succeed later — without it, every print attempt will fail with a
   generic "could not reach the bridge" error, because an unaccepted
   certificate looks the same as an unreachable server from JavaScript's
   point of view.
4. In the KDS app's Settings → Receipt Printer → Network Printer, enter
   the bridge computer's IP address, port `8008`, check "Bridge uses
   HTTPS," and click Connect.

## Multiple printers

If you have more than one physical printer, you have two ways to serve
them — pick whichever fits your setup better.

**Option A: one bridge process per printer (simplest to reason about).**
Run a separate `bridge.js` for each printer, each on its own
`--listen-port`:

```bash
node bridge.js --printer-host 192.168.1.30 --printer-port 9100 --listen-port 8008 --cert cert.pem --key key.pem
node bridge.js --printer-host 192.168.1.32 --printer-port 9100 --listen-port 8009 --cert cert.pem --key key.pem
```

(the same `cert.pem`/`key.pem` can be reused by both — it's just
identifying the bridge computer, not a specific printer). In the KDS
app, add one saved printer per bridge port — e.g. "Kitchen 1" at
`192.168.1.17:8008` and "Kitchen 2" at `192.168.1.17:8009`. Each is its
own process, so it needs its own certificate-trust visit
(`https://192.168.1.17:8008/status`, then `https://192.168.1.17:8009/status`)
and its own entry in whatever keeps it running (see "Keeping it running"
below).

**Option B: one bridge process relaying to several printers.** Give each
printer a name with a repeated `--printer` flag instead of
`--printer-host`/`--printer-port`:

```bash
node bridge.js --listen-port 8008 --cert cert.pem --key key.pem \
  --printer kitchen1=192.168.1.30:9100 --printer kitchen2=192.168.1.32:9100
```

Printing to a specific one means posting to `/print/<name>` instead of
plain `/print` (e.g. `/print/kitchen1`) — the KDS app's Settings →
Receipt Printer does this automatically once you fill in a printer's
"Printer name on this bridge" field when adding it there. You can also
click "Fetch printer list from bridge" in that form instead of typing
the name, which hits this bridge's `GET /printers` endpoint and offers
back whatever names you configured (`{"printers":["kitchen1","kitchen2"]}`
here). This option needs only one process, one port, and one
certificate-trust visit per device — worth it once you have more than a
couple of printers on the same bridge computer.

Either option is fine to mix with a single-printer bridge elsewhere —
the KDS app just sees each as a separate saved printer with its own
address (and, for option B, its own name on that bridge).

## Alternative: using Node-RED instead of bridge.js

If you already run [Node-RED](https://nodered.org/) — or would rather manage
this with a visual editor than a standalone script — `node-red-flow.json` in
this folder does exactly the same job as `bridge.js`, built as a Node-RED
flow instead of hand-written code. I built and tested this flow end to end
(a real HTTP POST → real TCP relay → real response, including the failure
path) before including it here, so it's not a guess.

**Import it:** open your Node-RED editor → menu (top right) → Import → paste
the contents of `node-red-flow.json` (or drag the file in) → Deploy.

**What it contains:** two endpoints, matching `bridge.js` exactly —
- `GET /status` — a plain health check for the KDS app's "Connect" button.
  Doesn't touch the printer.
- `POST /print` — a Function node that opens a raw TCP connection to the
  printer, writes the request body, and responds `200 printed` on success or
  `502` with the underlying error if the printer couldn't be reached (wrong
  IP, powered off, port closed, etc.) — it does *not* just fire-and-forget
  and hope for the best.

**Before deploying, edit the printer's address:** open the "Relay bytes to
printer" Function node and change the two constants at the top —
`PRINTER_HOST` and `PRINTER_PORT` — to your printer's actual IP and port
(9100 unless its manual says otherwise).

**Two settings.js changes this flow depends on** — add these to whichever
`settings.js` your Node-RED instance uses, then restart Node-RED:

```js
module.exports = {
  // ...your existing settings...
  functionExternalModules: true, // lets the Function node import Node's built-in `net` module
  httpNodeCors: {
    origin: '*',        // or lock this to your KDS app's exact origin later
    methods: 'GET,POST,OPTIONS',
  },
}
```

The `httpNodeCors` line matters more than it looks: it's what makes the
browser's CORS preflight (`OPTIONS /print`) actually work. I tried handling
that with an ordinary Node-RED node first, and it turned out Express (which
Node-RED's HTTP layer is built on) intercepts `OPTIONS` requests to a
registered path automatically, before any node in the flow ever sees them —
so a manually-added OPTIONS node is silently never reached. `httpNodeCors`
is the one approach that's actually reliable, which is why the flow relies
on it instead.

The same HTTPS/certificate requirement as `bridge.js` applies here too: if
Node-RED is only serving plain `http://`, an https-loaded KDS app can't
reach it (mixed content). Node-RED's own `settings.js` supports an `https`
block for a key/cert pair, the same self-signed certificate from the steps
above works — see [Node-RED's own docs on securing Node-RED](https://nodered.org/docs/user-guide/runtime/securing-node-red)
for the exact `https` settings.js syntax, since it's Node-RED's own setting
rather than something specific to this flow.

## Keeping it running

For anything beyond testing, run the bridge as a background service so
it survives reboots — for example with `pm2` (`npx pm2 start bridge.js --
--printer-host ... --cert cert.pem --key key.pem`, then `pm2 save` and
`pm2 startup`), a `systemd` unit, or Windows Task Scheduler running it at
login. This is standard practice for any small always-on service and
isn't specific to this bridge.

## Troubleshooting

- **"Could not reach the bridge" in the KDS app** — check the bridge
  process is actually running and printed its "listening on ..." line;
  check the bridge computer's firewall allows inbound connections on the
  listen port; check the KDS device and the bridge computer are on the
  same network (same Wi-Fi/VLAN); if using HTTPS, make sure you've
  visited `/status` once on that exact device to accept the certificate.
- **Bridge is reachable but nothing prints** — the bridge logs
  `Print relay failed: ...` with the underlying TCP error when it can't
  reach the printer itself; double-check the printer's IP and port
  (9100 unless the printer's manual says otherwise), and that the
  printer is powered on and on the network.
- **Garbled or blank output** — this is the same ESC/POS byte format the
  Bluetooth option already uses (see `src/lib/printer.js`), so if it
  prints garbage, the printer likely needs a different codepage/init
  sequence than the default one this app sends — that's a change to
  `buildEscPosReceipt()` in the app, not to the bridge.
