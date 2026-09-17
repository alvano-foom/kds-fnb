import { useState } from 'react'
import { usePrinterStore } from '../../store/printerStore'
import { isBluetoothSupported, pairPrinter, printTestTicket } from '../../lib/printer'
import { Button } from '../atoms/Button'

/**
 * Pairs a BLE thermal printer once so OrderCard's Print button can write
 * tickets straight to it instead of going through window.print() — see
 * src/lib/printer.js for the platform constraints (BLE only, never
 * classic/SPP Bluetooth; Chrome/Edge only; needs a real button click).
 */
export function PrinterConfig() {
  const { status, deviceName, serviceLabel, error, setConnecting, setConnected, setError, disconnect } =
    usePrinterStore()
  const [testing, setTesting] = useState(false)

  if (!isBluetoothSupported()) {
    return (
      <p className="text-sm text-gray-500">
        This browser doesn't support Bluetooth printing (Web Bluetooth needs Chrome or Edge, on
        desktop or Android — not Safari/iOS). The Print button on each card still works via your
        system's regular print dialog.
      </p>
    )
  }

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

  async function handleTestPrint() {
    setTesting(true)
    try {
      await printTestTicket(usePrinterStore.getState().characteristic)
    } catch (err) {
      setError(err?.message || 'Test print failed — check the printer is on and in range.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Pair a Bluetooth Low Energy (BLE) thermal printer once here to print tickets directly from
        each card's Print button — no print dialog, no OS driver. Classic Bluetooth (SPP)
        printers can't be reached from a browser at all and won't show up below.
      </p>

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
        <Button type="button" onClick={handlePair} disabled={status === 'connecting'}>
          {status === 'connecting' ? 'Connecting…' : deviceName ? `Reconnect to ${deviceName}` : 'Pair Printer'}
        </Button>
      )}

      {status === 'error' && error && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{error}</p>
      )}

      {status === 'connected' && (
        <Button type="button" variant="secondary" onClick={handleTestPrint} disabled={testing}>
          {testing ? 'Printing…' : 'Send test print'}
        </Button>
      )}
    </div>
  )
}
