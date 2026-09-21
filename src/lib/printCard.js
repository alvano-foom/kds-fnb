import { printReceipt } from './receipt'
import { formatReceiptPreview, isTestPrinterCharacteristic, printViaBluetooth } from './printer'
import { printViaNetwork } from './networkPrinter'
import { usePrinterStore } from '../store/printerStore'
import { useErrorLogStore } from '../store/errorLogStore'

function logFallback(card, transport, err) {
  useErrorLogStore.getState().logError({
    category: 'printer',
    message: `${transport} print failed for ${card.order_name ?? card.id ?? 'an order'} — fell back to the print dialog.`,
    detail: err?.message ?? String(err),
  })
  return printReceipt(card)
}

/**
 * One ticket, however it needs to get to paper: straight to the paired
 * Bluetooth printer or network printer bridge if one's connected, the
 * simulated Test Printer's on-screen log if that's what's "connected"
 * (see printer.js), otherwise (or if a real print attempt fails —
 * printer off, out of range, bridge unreachable) the browser's print
 * dialog via receipt.js. Shared by OrderCard's manual Print button and
 * PendingOrderAlerts' auto-print, so the two never drift apart.
 *
 * @param {import('../types').OrderLineCard} card
 * @param {{ status: string, connectionType?: string|null, characteristic?: object|null, activePrinter?: { host?: string, port?: string|number, secure?: boolean, printer?: string }|null }} printer
 *   the relevant slice of usePrinterStore's state, plus `activePrinter` —
 *   the saved profile the live connection belongs to (see
 *   useActivePrinter() in printerStore.js), which is where a 'network'
 *   connection's host/port/secure/printer come from. `connectionType` is
 *   the primary switch; `isTestPrinterCharacteristic` is also checked so
 *   callers that only pass `characteristic` (as some existing tests do)
 *   still route to the Test Printer correctly.
 */
export function printCard(card, printer) {
  if (printer?.status === 'connected') {
    if (printer.connectionType === 'test' || isTestPrinterCharacteristic(printer.characteristic)) {
      usePrinterStore.getState().logTestPrint(card, formatReceiptPreview(card))
      return Promise.resolve()
    }

    if (printer.connectionType === 'network') {
      const { host, port, secure, printer: printerName } = printer.activePrinter || {}
      return printViaNetwork({ host, port, secure, printer: printerName }, card).catch((err) => logFallback(card, 'Network', err))
    }

    if (printer.characteristic) {
      return printViaBluetooth(printer.characteristic, card).catch((err) => logFallback(card, 'Bluetooth', err))
    }
  }
  return Promise.resolve(printReceipt(card))
}
