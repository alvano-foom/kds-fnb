import { useState } from 'react'
import { usePrinterStore } from '../../store/printerStore'
import {
  connectTestPrinter,
  formatReceiptPreview,
  isBluetoothSupported,
  isTestPrinterCharacteristic,
  pairPrinter,
  printTestTicket,
  TEST_CARD,
} from '../../lib/printer'
import { checkNetworkBridge, testNetworkConnection } from '../../lib/networkPrinter'
import { printViaAndroidBridge } from '../../lib/androidPrintBridge'
import { Button } from '../atoms/Button'

/**
 * Three independent things live here:
 *  - Print trigger: manual (Print button on each card) vs. automatic
 *    (fires the moment a card enters "pending", same event as the voice
 *    announcement — see PendingOrderAlerts.jsx). Works no matter what's
 *    connected below, or if nothing is: with no printer, it falls back to
 *    the browser's print dialog, same as a manual Print click.
 *  - Which printer is connected — exactly one of:
 *      - Bluetooth: pairs a real BLE thermal printer once so tickets go
 *        straight to it, silently, no popup — see src/lib/printer.js for
 *        the platform constraints (BLE only, never classic/SPP Bluetooth;
 *        Chrome/Edge only; needs a real button click).
 *      - Network (IP address): prints to a printer reachable over the
 *        network via a small bridge program (printer-bridge/ at the
 *        project root) — see src/lib/networkPrinter.js for why a bridge
 *        is required at all (no raw TCP sockets from a browser) and the
 *        https/mixed-content wrinkle that comes with it.
 *      - Android Print Helper: hands tickets to a native companion app
 *        (printer-service-main, alongside this repo) on THIS SAME
 *        tablet via a kdsprint:// intent — see
 *        src/lib/androidPrintBridge.js. Only useful when this page is
 *        itself running in that tablet's browser; it reaches a
 *        classic-Bluetooth printer (which Web Bluetooth above can never
 *        see) or a network printer with no separate bridge computer.
 *      - Test Printer: a software-only stand-in for when there's no real
 *        printer in the room. Logs what would have printed right here —
 *        also silent, no popup — so the print pipeline (including
 *        auto-print) can be verified on its own before real hardware is
 *        involved.
 */
export function PrinterConfig() {
  const {
    status,
    connectionType,
    deviceName,
    serviceLabel,
    error,
    autoPrint,
    testPrints,
    networkHost,
    networkPort,
    networkSecure,
    androidTransport,
    androidMac,
    androidHost,
    androidPort,
    setAutoPrint,
    setConnecting,
    setConnected,
    setNetworkConnected,
    setNetworkHost,
    setNetworkPort,
    setNetworkSecure,
    setAndroidTransport,
    setAndroidMac,
    setAndroidHost,
    setAndroidPort,
    setAndroidConnected,
    setError,
    disconnect,
    clearTestPrints,
  } = usePrinterStore()
  const [testing, setTesting] = useState(false)
  const [connectingVia, setConnectingVia] = useState(null)
  const usingTestPrinter = status === 'connected' && connectionType === 'test'

  async function handlePair() {
    setConnectingVia('bluetooth')
    setConnecting()
    try {
      const { device, characteristic, serviceLabel: label } = await pairPrinter()
      device.addEventListener('gattserverdisconnected', () => usePrinterStore.getState().handleUnexpectedDisconnect())
      setConnected({ device, characteristic, serviceLabel: label })
    } catch (err) {
      if (err?.name === 'NotFoundError') {
        // The person closed the device chooser without picking anything —
        // not a failure, just back to idle.
        usePrinterStore.setState({ status: 'idle' })
        return
      }
      setError(err?.message || 'Could not connect to the printer.')
    }
  }

  function handleUseTestPrinter() {
    setConnected(connectTestPrinter())
  }

  function handleUseAndroidBridge() {
    // No handshake possible from here (see printerStore.js) — this just
    // records the chosen transport/address as active.
    setAndroidConnected()
  }

  async function handleConnectNetwork() {
    setConnectingVia('network')
    setConnecting()
    try {
      await checkNetworkBridge({ host: networkHost, port: networkPort, secure: networkSecure })
      setNetworkConnected()
    } catch (err) {
      setError(err?.message || 'Could not reach the printer bridge.')
    }
  }

  async function handleTestPrint() {
    setTesting(true)
    try {
      if (connectionType === 'network') {
        await testNetworkConnection({ host: networkHost, port: networkPort, secure: networkSecure })
      } else if (connectionType === 'android') {
        await printViaAndroidBridge(
          { transport: androidTransport, mac: androidMac, host: androidHost, port: androidPort },
          TEST_CARD,
        )
      } else {
        const { characteristic } = usePrinterStore.getState()
        if (connectionType === 'test' || isTestPrinterCharacteristic(characteristic)) {
          usePrinterStore.getState().logTestPrint(TEST_CARD, formatReceiptPreview(TEST_CARD))
        } else {
          await printTestTicket(characteristic)
        }
      }
    } catch (err) {
      setError(err?.message || 'Test print failed — check the printer is on and reachable.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={(e) => setAutoPrint(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/20"
          />
          <span className="text-sm font-medium text-gray-700">Automatically print each new order</span>
        </label>
        <p className="mt-1.5 pl-6 text-xs text-gray-400">
          {autoPrint
            ? 'A ticket prints the moment a card enters Pending — no need to click Print. You can still reprint any card manually too.'
            : 'Off by default: tickets only print when someone clicks a card\'s Print button.'}
        </p>
      </div>

      {status === 'connected' ? (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span>
            {connectionType === 'network' &&
              `Connected: ${networkHost}:${networkPort} (network printer bridge)`}
            {connectionType === 'android' &&
              (androidTransport === 'bluetooth'
                ? `Connected: Android print helper → Bluetooth ${androidMac}`
                : `Connected: Android print helper → ${androidHost}:${androidPort}`)}
            {connectionType !== 'network' &&
              connectionType !== 'android' &&
              `Connected: ${deviceName}${serviceLabel ? ` (${serviceLabel})` : ''}`}
          </span>
          <button type="button" onClick={disconnect} className="text-xs font-medium underline">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {isBluetoothSupported() ? (
              <>
                <p className="text-xs text-gray-400">
                  Pair a Bluetooth Low Energy (BLE) thermal printer once here to print tickets
                  directly — no print dialog, no OS driver. Classic Bluetooth (SPP) printers can't be
                  reached from a browser at all and won't show up in the chooser.
                </p>
                <Button type="button" onClick={handlePair} disabled={status === 'connecting'}>
                  {status === 'connecting' && connectingVia === 'bluetooth'
                    ? 'Connecting…'
                    : deviceName
                      ? `Reconnect to ${deviceName}`
                      : 'Pair Printer'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                This browser doesn't support Bluetooth printing (Web Bluetooth needs Chrome or Edge,
                on desktop or Android — not Safari/iOS).
              </p>
            )}
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Network Printer (IP address)</p>
            <p className="text-xs text-gray-400">
              Print to a printer reachable over the network, via a small bridge program you run on a
              computer on that same network — browsers can't open a direct connection to a printer's
              network port, so this needs a bridge in between. See the{' '}
              <code className="font-mono">printer-bridge</code> folder in the project for that bridge
              and setup steps — including the extra step needed if this app is loaded over https
              (it almost certainly is), since an https page can't reach a plain http bridge at all.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={networkHost}
                onChange={(e) => setNetworkHost(e.target.value)}
                placeholder="Bridge IP, e.g. 192.168.1.50"
                aria-label="Printer bridge IP address or hostname"
                className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={networkPort}
                onChange={(e) => setNetworkPort(e.target.value)}
                placeholder="Port"
                aria-label="Printer bridge port"
                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={networkSecure}
                  onChange={(e) => setNetworkSecure(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                Bridge uses HTTPS
              </label>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleConnectNetwork}
              disabled={status === 'connecting' || !networkHost.trim()}
            >
              {status === 'connecting' && connectingVia === 'network' ? 'Connecting…' : 'Connect'}
            </Button>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Android Print Helper</p>
            <p className="text-xs text-gray-400">
              Only useful when this board is itself open in an Android tablet's browser: hands each
              ticket to a small companion app on that same tablet (see{' '}
              <code className="font-mono">printer-service-main</code> in the project), which reaches
              the printer directly — a classic-Bluetooth printer Web Bluetooth above can't see at all,
              or a network printer with no separate bridge computer.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="android-transport"
                  checked={androidTransport === 'bluetooth'}
                  onChange={() => setAndroidTransport('bluetooth')}
                />
                Bluetooth
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="android-transport"
                  checked={androidTransport === 'network'}
                  onChange={() => setAndroidTransport('network')}
                />
                Network
              </label>
            </div>
            {androidTransport === 'bluetooth' ? (
              <input
                type="text"
                value={androidMac}
                onChange={(e) => setAndroidMac(e.target.value)}
                placeholder="Printer Bluetooth address, e.g. AA:BB:CC:DD:EE:FF"
                aria-label="Printer Bluetooth address"
                className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={androidHost}
                  onChange={(e) => setAndroidHost(e.target.value)}
                  placeholder="Printer IP, e.g. 192.168.1.50"
                  aria-label="Android print helper printer IP address"
                  className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={androidPort}
                  onChange={(e) => setAndroidPort(e.target.value)}
                  placeholder="Port"
                  aria-label="Android print helper printer port"
                  className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleUseAndroidBridge}
              disabled={androidTransport === 'bluetooth' ? !androidMac.trim() : !androidHost.trim()}
            >
              Use Android Print Helper
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={handleUseTestPrinter}>
              Use Test Printer
            </Button>
            <p className="mt-1.5 text-xs text-gray-400">
              No hardware needed — logs each ticket below instead of printing it, so you can check
              the whole flow (including auto-print) works before setting up a real printer.
            </p>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{error}</p>
      )}

      {status === 'connected' && (
        <Button type="button" variant="secondary" onClick={handleTestPrint} disabled={testing}>
          {testing ? 'Printing…' : 'Send test print'}
        </Button>
      )}

      {usingTestPrinter && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Test Printer Output</span>
            {testPrints.length > 0 && (
              <button type="button" onClick={clearTestPrints} className="text-xs font-medium text-gray-400 underline">
                Clear
              </button>
            )}
          </div>
          {testPrints.length === 0 ? (
            <p className="text-xs text-gray-400">
              Nothing printed yet — click Print on a card, turn on auto-print, or use "Send test
              print" above.
            </p>
          ) : (
            <ul className="space-y-2">
              {testPrints.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                  <p className="mb-1 text-[11px] text-gray-400">{new Date(entry.printedAt).toLocaleTimeString()}</p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700">{entry.preview}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
