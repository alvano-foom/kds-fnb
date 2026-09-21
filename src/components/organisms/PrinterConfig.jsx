import { useState } from 'react'
import { usePrinterStore, useActivePrinter, generatePrinterId } from '../../store/printerStore'
import {
  connectTestPrinter,
  formatReceiptPreview,
  isBluetoothSupported,
  isTestPrinterCharacteristic,
  pairPrinter,
  printTestTicket,
  TEST_CARD,
} from '../../lib/printer'
import { checkNetworkBridge, listBridgePrinters, testNetworkConnection } from '../../lib/networkPrinter'
import { Button } from '../atoms/Button'

const DEFAULT_BRIDGE_PORT = '8008'

/**
 * Two independent things live here:
 *  - Print trigger: manual (Print button on each card) vs. automatic
 *    (fires the moment a card enters "pending", same event as the voice
 *    announcement — see PendingOrderAlerts.jsx). Works no matter what's
 *    connected below, or if nothing is: with no printer, it falls back to
 *    the browser's print dialog, same as a manual Print click.
 *  - Which printer is connected — exactly one of:
 *      - Bluetooth: pairs a real BLE thermal printer once so tickets go
 *        straight to it, silently, no popup — see src/lib/printer.js for
 *        the platform constraints (BLE only, never classic/SPP Bluetooth;
 *        Chrome/Edge only; needs a real button click). Web Bluetooth has
 *        no silent reconnect, so there's just one "Pair Printer" action
 *        here rather than a saved list — a saved profile couldn't skip
 *        the chooser anyway.
 *      - Network Printer: prints to a printer reachable over the network
 *        via a small bridge program (printer-bridge/ at the project
 *        root) — see src/lib/networkPrinter.js for why a bridge is
 *        required at all (no raw TCP sockets from a browser) and the
 *        https/mixed-content wrinkle that comes with it. Unlike
 *        Bluetooth, a bridge address is just a remembered host/port, so
 *        these ARE saved as a list of named profiles — add each printer
 *        once, then just pick "Use" on whichever one a station needs.
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
    printers,
    activePrinterId,
    setAutoPrint,
    setConnecting,
    setConnected,
    setNetworkConnected,
    setError,
    disconnect,
    clearTestPrints,
    savePrinter,
    removePrinter,
  } = usePrinterStore()
  const activePrinter = useActivePrinter()
  const networkPrinters = printers.filter((p) => p.type === 'network')

  const [testing, setTesting] = useState(false)
  const [connectingId, setConnectingId] = useState(null)
  const usingTestPrinter = status === 'connected' && connectionType === 'test'

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formHost, setFormHost] = useState('')
  const [formPort, setFormPort] = useState(DEFAULT_BRIDGE_PORT)
  const [formSecure, setFormSecure] = useState(true)
  const [formPrinterName, setFormPrinterName] = useState('')
  const [formError, setFormError] = useState(null)
  const [bridgePrinterOptions, setBridgePrinterOptions] = useState([])
  const [fetchingBridgeList, setFetchingBridgeList] = useState(false)

  async function handlePair() {
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

  function resetForm() {
    setFormName('')
    setFormHost('')
    setFormPort(DEFAULT_BRIDGE_PORT)
    setFormSecure(true)
    setFormPrinterName('')
    setFormError(null)
    setBridgePrinterOptions([])
  }

  function openAddForm() {
    resetForm()
    setEditingId(null)
    setFormOpen(true)
  }

  function openEditForm(profile) {
    setEditingId(profile.id)
    setFormName(profile.name || '')
    setFormHost(profile.host || '')
    setFormPort(profile.port || DEFAULT_BRIDGE_PORT)
    setFormSecure(Boolean(profile.secure))
    setFormPrinterName(profile.printer || '')
    setFormError(null)
    setBridgePrinterOptions([])
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
  }

  function handleSaveForm(e) {
    e.preventDefault()
    if (!formHost.trim()) {
      setFormError("Enter the printer bridge's IP address or hostname first.")
      return
    }
    savePrinter({
      id: editingId || generatePrinterId(),
      name: formName.trim() || formHost.trim(),
      type: 'network',
      host: formHost.trim(),
      port: formPort.trim() || DEFAULT_BRIDGE_PORT,
      secure: formSecure,
      printer: formPrinterName.trim(),
    })
    closeForm()
  }

  async function handleFetchBridgePrinters() {
    if (!formHost.trim()) {
      setFormError("Enter the printer bridge's IP address first.")
      return
    }
    setFetchingBridgeList(true)
    setFormError(null)
    try {
      const names = await listBridgePrinters({ host: formHost, port: formPort, secure: formSecure })
      setBridgePrinterOptions(names)
      if (names.length === 0) {
        setFormError(
          'Reached the bridge, but it has no named printers configured — leave "Printer name" blank if it only relays to one.',
        )
      }
    } catch (err) {
      setFormError(err?.message || 'Could not reach the bridge.')
    } finally {
      setFetchingBridgeList(false)
    }
  }

  async function handleUseNetworkPrinter(profile) {
    setConnectingId(profile.id)
    setConnecting()
    try {
      await checkNetworkBridge({ host: profile.host, port: profile.port, secure: profile.secure })
      setNetworkConnected(profile.id)
    } catch (err) {
      setError(err?.message || 'Could not reach the printer bridge.')
    } finally {
      setConnectingId(null)
    }
  }

  function handleRemovePrinter(id) {
    if (activePrinterId === id) disconnect()
    if (editingId === id) closeForm()
    removePrinter(id)
  }

  async function handleTestPrint() {
    setTesting(true)
    try {
      if (connectionType === 'network') {
        await testNetworkConnection({
          host: activePrinter?.host,
          port: activePrinter?.port,
          secure: activePrinter?.secure,
          printer: activePrinter?.printer,
        })
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
              `Connected: ${activePrinter?.name || 'Network Printer'} (${activePrinter?.host}:${activePrinter?.port}${
                activePrinter?.printer ? ` → ${activePrinter.printer}` : ''
              })`}
            {connectionType !== 'network' &&
              `Connected: ${activePrinter?.name ? `${activePrinter.name} — ` : ''}${deviceName}${serviceLabel ? ` (${serviceLabel})` : ''}`}
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
                  {status === 'connecting' && connectingId === null
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

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Network Printers</p>
              <p className="mt-1 text-xs text-gray-400">
                Printers reachable over the network, each via a small bridge program you run on a
                computer on that same network — browsers can't open a direct connection to a
                printer's network port, so this needs a bridge in between (see the{' '}
                <code className="font-mono">printer-bridge</code> folder in the project). Add each
                printer's bridge address once below, then just click "Use" to switch stations
                between them.
              </p>
            </div>

            {networkPrinters.length > 0 && (
              <ul className="space-y-1.5">
                {networkPrinters.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.host}:{p.port}
                        {p.printer ? ` → ${p.printer}` : ''}
                        {p.secure ? ' · https' : ' · http'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => handleUseNetworkPrinter(p)}
                        disabled={status === 'connecting'}
                      >
                        {status === 'connecting' && connectingId === p.id ? 'Connecting…' : 'Use'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => openEditForm(p)}
                        className="px-1.5 text-xs font-medium text-gray-400 underline hover:text-gray-600"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePrinter(p.id)}
                        className="px-1.5 text-xs font-medium text-gray-400 underline hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {formOpen ? (
              <form onSubmit={handleSaveForm} className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Name, e.g. Kitchen 1"
                    aria-label="Printer name"
                    className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="Bridge IP, e.g. 192.168.1.17"
                    aria-label="Printer bridge IP address or hostname"
                    className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                    placeholder="Port"
                    aria-label="Printer bridge port"
                    className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={formSecure}
                      onChange={(e) => setFormSecure(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    Bridge uses HTTPS
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    list="bridge-printer-options"
                    value={formPrinterName}
                    onChange={(e) => setFormPrinterName(e.target.value)}
                    placeholder="Printer name on this bridge (leave blank if it relays to just one)"
                    aria-label="Printer name on this bridge"
                    className="w-80 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <datalist id="bridge-printer-options">
                    {bridgePrinterOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={handleFetchBridgePrinters}
                    disabled={fetchingBridgeList || !formHost.trim()}
                    className="text-xs font-medium text-brand underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {fetchingBridgeList ? 'Checking…' : 'Fetch printer list from bridge'}
                  </button>
                </div>
                {formError && <p className="text-xs text-amber-700">{formError}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit" className="px-3 py-1.5 text-xs">
                    {editingId ? 'Save changes' : 'Add printer'}
                  </Button>
                  <button type="button" onClick={closeForm} className="text-xs font-medium text-gray-400 underline">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <Button type="button" variant="secondary" onClick={openAddForm} className="px-3 py-1.5 text-xs">
                + Add a network printer
              </Button>
            )}
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
