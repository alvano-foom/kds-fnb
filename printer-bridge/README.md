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
  talks to. **This has to be a machine that physically stays at that
  location, on that network, all the time** — not your own laptop that
  you carry home at the end of the day. `pm2`/`systemd` (see "Keeping it
  running" below) only keeps the bridge *process* alive and restarts it
  automatically on *that same machine* — it can't follow the machine
  somewhere else, and if the computer it's on leaves the network or gets
  turned off, the bridge goes down with it until it's back. It needs
  [Node.js](https://nodejs.org) installed (any reasonably recent version)
  — nothing else, no `npm install` required for the core relay (see
  "Stable hostname (mDNS)" below if you want that optional feature).
- The printer's IP address and raw print port (check the printer's own
  network settings page or its manual — port **9100** is the default for
  the vast majority of network thermal/label printers).

### Can the bridge just run on the kitchen tablet itself?

**In practice, no — don't try this, even though it sounds like it'd save
buying a separate box.** The tablet is where the KDS *webpage* runs, in a
regular browser tab; `bridge.js` needs to run as an actual background
server process, which is a different thing a browser tab can't do. What's
possible depends on the tablet:

- **iPad/iOS:** not possible at all, full stop. iOS doesn't let an
  ordinary app keep a server listening on a port in the background —
  there's no way around this without jailbreaking, which isn't something
  to do to a kitchen device.
- **Android tablet:** technically possible via Termux (a terminal app that
  can run Node.js), but unreliable enough that it's not recommended for
  real use: Android aggressively kills background processes to save
  battery, the bridge dies the moment the screen locks or the tablet
  sleeps unless you fight Android's battery-optimization settings
  constantly, and it won't restart itself after a reboot without extra
  setup `pm2`/`systemd` give you for free on a real computer. One bad
  battery-saver update and tickets silently stop printing.
- Even where it's technically possible, running the bridge on the *same*
  tablet it's meant to serve only helps that one tablet — a second tablet
  in the kitchen would need its own separate bridge instance to print,
  instead of all tablets sharing one bridge the way they do today.

This is exactly why "a spare PC or a cheap Raspberry Pi, left on
permanently" (above) is the real recommendation rather than a
workaround — a Pi costs about the same as a kitchen tablet case and just
quietly does this one job forever, which is worth it compared to fighting
a mobile OS that was never designed to run background servers.

#### If it's an Android tablet that's always on and you want to try it anyway

A tablet that's genuinely kept on standby at one fixed station (not
carried around, screen rarely fully off) removes some of the risk above —
it's the "survives a reboot / the screen locking" part that's fragile, not
the "has to leave the network" part, since it never leaves. This is still
a real, working path for one self-contained tablet; it's just more manual
setup than a $20 Pi, and the battery-optimization risk below is genuinely
the thing most likely to bite you later, quietly.

1. **Install Termux from F-Droid** (f-droid.org/packages/com.termux —
   **not** the Play Store version, which is outdated and unmaintained).
   Also install its two companion apps from F-Droid: **Termux:API** and
   **Termux:Boot**.
2. **Exempt Termux from battery optimization**: Android Settings → Apps →
   Termux → Battery → set to "Unrestricted" (not "Optimized"). Do the same
   for Termux:Boot. **If this is a Samsung/Xiaomi/Huawei/etc. tablet**,
   there is almost certainly a second, manufacturer-specific battery
   manager on top of stock Android's (often called something like
   "Auto-start manager", "Protected apps", or "Battery/App management" in
   the main Settings app, not inside the app's own page) — standard
   Android's battery-optimization toggle alone will NOT stop that one from
   killing Termux. Find it for your specific tablet brand and allow
   Termux (and Termux:Boot) there too.
3. **Inside Termux**, install Node.js and pm2:
   ```bash
   pkg update && pkg install nodejs
   npm install -g pm2
   ```
4. **Get the `printer-bridge` folder onto the tablet** — easiest is
   `termux-setup-storage` (grants Termux access to the tablet's normal
   storage) and copying it into the Downloads folder from wherever you
   prepared it, or `pkg install git` + `git clone` if this repo is
   reachable from the tablet's network.
5. **Start it bound to localhost, no certificate needed** — since the
   bridge and the KDS webpage are on the exact same device this time,
   point the KDS app at `127.0.0.1` instead of a LAN IP, with HTTPS
   *unchecked*: Chrome (and most browsers) specifically exempt
   `http://127.0.0.1`/`http://localhost` from mixed-content blocking, so a
   plain http bridge works here even though the KDS app itself is loaded
   over https — no self-signed certificate step needed for this one case.
   ```bash
   cd printer-bridge
   pm2 start bridge.js --name kds-bridge -- --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008
   pm2 save
   ```
   In the KDS app's Settings → Receipt Printer → Network Printer, add a
   printer with IP `127.0.0.1`, open "Advanced", and uncheck "Bridge uses
   HTTPS" (it's checked by default).
6. **Make it survive a reboot** — Termux has no systemd, so `pm2 startup`
   won't work the normal way; use Termux:Boot instead. Create
   `~/.termux/boot/start-bridge.sh`:
   ```bash
   #!/data/data/com.termux/files/usr/bin/sh
   termux-wake-lock
   pm2 resurrect
   ```
   and make it executable (`chmod +x ~/.termux/boot/start-bridge.sh`).
   `termux-wake-lock` (from the Termux:API package) is what stops Android
   from suspending Termux once it's no longer the on-screen app — this is
   the piece that specifically addresses "the tablet's always on, just
   showing the KDS board, not Termux" in your setup.
7. **Check it survives for real**, not just right after setup: reboot the
   tablet once, wait a few minutes, and confirm in the KDS app's Settings
   screen that this printer still shows "● Reachable" (the per-printer
   live badge added in this same update) without you touching anything.
   That badge is genuinely the easiest way to notice if an Android update
   quietly broke this weeks later, since nothing else will tell you.

If this ever turns out to be more upkeep than it's worth, the fallback is
still a $20 secondhand PC or a Pi running the exact same `bridge.js` — this
section doesn't lock you into the Termux route, it's just the honest
how-to for the path you're already leaning toward.

## Which IP do I actually visit for /status?

This trips people up constantly, so it gets its own section before anything
else: **`/status` is served by the bridge process itself** — whatever
computer is actually running `node bridge.js` — **never by the printer.**
The printer has no idea `/status` exists; it only speaks raw ESC/POS bytes
on its print port (9100).

Concretely, two different IP addresses show up in the commands on this
page, and they are *not* the same thing:

- `--printer-host 192.168.1.20` (or `--printer kitchen1=192.168.1.30:9100`)
  is the **printer's** own network address — where the bridge sends the
  print bytes. You never open this one in a browser; there's nothing there
  to visit.
- The address you put in the KDS app's "Bridge IP" field, and the one you
  open as `http(s)://<that-address>:8008/status` to accept a self-signed
  certificate, is the IP of **the computer running `node bridge.js`** —
  a Raspberry Pi, a spare PC, whatever you started the bridge on. That's
  the `--listen-port` side (8008 by default), not the `--printer-host`
  side.

These two machines are almost always different boxes (the bridge computer
and the printer are separate devices on the same network) — so if you ran
`node bridge.js --printer-host 192.168.1.30 ...`, do **not** visit
`192.168.1.30:8008/status`; that's asking the printer itself to answer an
HTTP request it doesn't understand, and it'll just time out.

**`bridge.js` now prints this for you at startup** — look for a line like

```
This is what to actually visit/enter — this computer's address:
  https://192.168.1.17:8008/status  (use 192.168.1.17 in the KDS app's "Bridge IP" field)
```

right after "Print bridge listening on...". Use whatever IP it prints
there. If that section says it couldn't detect one (uncommon — some VPN
setups or unusual network configs), find the IP of the machine you
actually ran that `node bridge.js` command on by hand (`ip addr` on
Linux/Raspberry Pi OS, `ipconfig` on Windows, `ifconfig` on macOS) and
use that one everywhere — in the KDS app's "Bridge IP" field, and in the
one-time `/status` visit to accept the certificate.

## Stable hostname (mDNS) — so the bridge's address doesn't drift

Every example below uses a raw IP address (`192.168.1.20`) for the bridge
computer itself. That address usually comes from DHCP, which means it can
silently change — a router reboot, the bridge computer being off for a
while and losing its lease, a new device joining the network — and when it
does, every tablet's saved "Bridge IP" breaks at once with no obvious cause.

`bridge.js` solves this by advertising itself over mDNS (the same
technology behind AirPrint and Chromecast discovery) as a fixed name —
`kds-bridge.local` by default — instead of relying only on the IP staying
put. This is **on by default** and needs no flags:

```bash
node bridge.js --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008
```

will log a line like:

```
Also advertising http://kds-bridge.local:8008 via mDNS. ...
```

Once you see that line, use `kds-bridge.local` (or `https://kds-bridge.local:8008`
if you're running with `--cert`/`--key`) in the KDS app's "Bridge IP" field
instead of the numeric IP. If the bridge computer's IP changes later, the
name keeps resolving and nothing in the KDS app needs to be touched.

**Enabling it (one-time):** the mDNS piece uses the optional
`bonjour-service` package. If you see `mDNS advertising skipped —
bonjour-service isn't installed` in the bridge's log, run `npm install`
once in this folder (`printer-bridge/`) and restart the bridge — the core
print relay works identically with or without this step, so it's safe to
skip entirely and just use the IP address instead.

**Flags:**
- `--mdns-name <name>` — advertise a name other than the default
  `kds-bridge` (becomes `<name>.local`). **Required** if you're running
  more than one bridge process on the same computer (see "Multiple
  printers" → Option A below) — give each its own name so they don't
  collide.
- `--no-mdns` — disable mDNS advertising entirely (falls back to IP-only,
  same as not having `bonjour-service` installed).

**Real compatibility caveats — please read before relying on this alone:**
`.local` name resolution is a real feature, not universally supported:
- **macOS/iOS** and most **Linux** (with `avahi`) resolve `.local` names
  out of the box — no extra software needed.
- **Windows** needs Bonjour Print Services or iTunes installed for `.local`
  names to resolve at all. Plain Windows, with neither installed, will not
  resolve `kds-bridge.local`.
- **Android/Chrome** support is inconsistent in practice, and kitchen
  tablets are very often Android. Test `kds-bridge.local` on your actual
  tablets before switching over — if it doesn't resolve there, use the
  bridge computer's IP address instead (or set up a DHCP reservation /
  static IP for it on your router, which sidesteps the drift problem a
  different way).

If mDNS doesn't work on a given device, everything else in this README
still applies unchanged — just use the numeric IP address for that device
instead of the `.local` name.

### Alternative: giving the bridge computer a static IP instead

mDNS is the easiest fix for drift, but it's a router/network-level thing,
not something `bridge.js` or the KDS app can do for you from code — there's
no flag here that "sets the IP to static." Two real ways to do it,
depending on who's in control:

- **DHCP reservation on the router (recommended)** — the bridge computer
  keeps using normal DHCP, but the router is told to always hand it the
  same address (usually by its MAC address). This is the easier option:
  nothing to configure on the bridge computer itself, and it still survives
  that computer being reset or replaced (same MAC → same IP). Look for
  "DHCP reservation", "static lease", or "address reservation" in the
  router's admin page.
- **Static IP on the bridge computer's own network settings** — if you
  don't have router access, set a fixed address directly in the OS: on
  Raspberry Pi OS, `sudo raspi-config` → *System Options* → *Network* (or
  edit `/etc/dhcpcd.conf`); on Windows, Network & Internet Settings →
  Properties → IP assignment → Manual; on macOS, System Settings → Network
  → the adapter → Details → TCP/IP → Configure IPv4 → Manually. Make sure
  the address you pick is outside your router's DHCP range so nothing else
  gets handed the same one later.

Either way, once the bridge computer's IP stops changing, enter that fixed
IP in the KDS app's "Bridge IP" field once and it never needs to be touched
again — the same outcome mDNS gives you, just pinned at the network layer
instead of resolved by name.

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
below). If you're using the mDNS stable-hostname feature (see above),
give each process its own `--mdns-name` (e.g. `--mdns-name kitchen1`,
`--mdns-name kitchen2`) — otherwise both processes try to advertise the
same `kds-bridge.local` name and collide.

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

## Keeping it running — set up once, not every day

**Do this once and you should never have to manually run `node bridge.js`
again** — not daily, not after a power cut, not after anyone reboots the
bridge computer. Running the command by hand each time (like in the
examples earlier in this README) is only for the first test to confirm it
works; for actual use, wrap it in a background service that Linux/Windows
itself restarts automatically. This is completely standard for any small
always-on service, not something specific to this bridge, and it's a
one-time setup, not a daily chore for anyone.

**Option A — `pm2` (simplest, same steps on Raspberry Pi/Linux, Windows, or Mac):**

```bash
npm install -g pm2
pm2 start bridge.js --name kds-bridge -- --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008 --cert cert.pem --key key.pem
pm2 save
pm2 startup
```

(swap in your real `--printer-host`/cert flags from whichever command you
tested with earlier). That last `pm2 startup` line prints ONE more command
you need to copy and run once (it needs `sudo` on Linux) — that's what
registers pm2 itself to start on boot. After that, this survives reboots
and power cuts on its own: if the computer restarts, pm2 restarts, and
pm2 starts the bridge, no login or manual command needed. Useful commands
afterward: `pm2 status` (is it running), `pm2 logs kds-bridge` (see its
output), `pm2 restart kds-bridge` (after changing a flag — edit the
`pm2 start` line above and re-run it, or `pm2 restart kds-bridge --update-env`).

**Option B — `systemd` (Linux/Raspberry Pi OS native, no extra package):**
create `/etc/systemd/system/kds-bridge.service`:

```ini
[Unit]
Description=KDS print bridge
After=network.target

[Service]
ExecStart=/usr/bin/node /full/path/to/printer-bridge/bridge.js --printer-host 192.168.1.20 --printer-port 9100 --listen-port 8008 --cert /full/path/to/cert.pem --key /full/path/to/key.pem
WorkingDirectory=/full/path/to/printer-bridge
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

(use `which node` to get the right node path, and full absolute paths
throughout — `WorkingDirectory`/relative cert paths won't resolve the way
they do when run by hand from that folder). Then:

```bash
sudo systemctl enable --now kds-bridge
```

One command, once — `enable` makes it start on every boot, `--now` also
starts it immediately. Check it with `sudo systemctl status kds-bridge`
and `journalctl -u kds-bridge -f` (logs, live).

**Windows:** Task Scheduler, with a trigger of "At log on" or "At startup"
running `node bridge.js ...` — same one-time idea, Microsoft's own UI
instead of a config file.

Whichever option, the point is the same: configure it once, and it quietly
keeps itself running from then on — nobody should need to walk into the
kitchen and type that command again unless the bridge computer itself gets
replaced or the printer's IP changes.

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
