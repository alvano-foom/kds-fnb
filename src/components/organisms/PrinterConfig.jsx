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
import { Button } from '../atoms/Button'

/**
 * Three independent things live here:
 *  - Print trigger: manual (Print button on each card) vs. automatic
 *    (fires the moment a card enters "pending", same event as the voice
 *    announcement — see PendingOrderAlerts.jsx). Works no matter what's
 *    connected below, or if nothing is: with no printer, it falls back to
 *    the browser's print dialog, same as a manual Print click.
 *  - Bluetooth pairing: pairs a real BLE thermal printer once so tickets
 *    go straight to it, silently, no popup — see src/lib/printer.js for
 *    the platform constraints (BLE only, never classic/SPP Bluetooth;
 *    Chrome/Edge only; needs a real button click).
 *  - Test Printer: a software-only stand-in for when there's no real
 *    printer in the room. Logs what would have printed right here — also
 *    silent, no popup — so the print pipeline (including auto-print) can
 *    be verified on its own before real hardware is involved.
 */
export function PrinterConfig() {
  const {
    status,
    deviceName,
    serviceLabel,
    error,
    autoPrint,
    testPrints,
    setAutoPrint,
    setConnecting,
    setConnected,
    setError,
    disconnect,
    clearTestPrints,
  } = usePrinterStore()
  const [testing, setTesting] = useState(false)
  const usingTestPrinter = status === 'connected' && isTestPrinterCharacteristic(usePrinterStore.getState().characteristic)

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

  async function handleTestPrint() {
    setTesting(true)
    try {
      const { characteristic } = usePrinterStore.getState()
      if (isTestPrinterCharacteristic(characteristic)) {
        usePrinterStore.getState().logTestPrint(TEST_CARD, formatReceiptPreview(TEST_CARD))
      } else {
        await printTestTicket(characteristic)
      }
    } catch (err) {
      setError(err?.message || 'Test print failed — check the printer is on and in range.')
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
            Connected: {deviceName}
            {serviceLabel ? ` (${serviceLabel})` : ''}
          </span>
          <button type="button" onClick={disconnect} className="text-xs font-medium underline">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {isBluetoothSupported() ? (
            <>
              <p className="text-xs text-gray-400">
                Pair a Bluetooth Low Energy (BLE) thermal printer once here to print tickets
                directly — no print dialog, no OS driver. Classic Bluetooth (SPP) printers can't be
                reached from a browser at all and won't show up in the chooser.
              </p>
              <Button type="button" onClick={handlePair} disabled={status === 'connecting'}>
                {status === 'connecting' ? 'Connecting…' : deviceName ? `Reconnect to ${deviceName}` : 'Pair Printer'}
              </Button>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              This browser doesn't support Bluetooth printing (Web Bluetooth needs Chrome or Edge,
              on desktop or Android — not Safari/iOS).
            </p>
          )}
          <div>
            <Button type="button" variant="secondary" onClick={handleUseTestPrinter}>
              Use Test Printer
            </Button>
            <p className="mt-1.5 text-xs text-gray-400">
              No hardware needed — logs each ticket below instead of printing it, so you can check
              the whole flow (including auto-print) works before pairing a real printer.
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
