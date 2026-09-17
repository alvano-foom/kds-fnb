import { printReceipt } from './receipt'
import { formatReceiptPreview, isTestPrinterCharacteristic, printViaBluetooth } from './printer'
import { usePrinterStore } from '../store/printerStore'

/**
 * One ticket, however it needs to get to paper: straight to the paired
 * Bluetooth printer if one's connected, the simulated Test Printer's
 * on-screen log if that's what's "connected" (see printer.js), otherwise
 * (or if a real Bluetooth write fails — printer off, out of range,
 * mid-print disconnect) the browser's print dialog via receipt.js. Shared
 * by OrderCard's manual Print button and PendingOrderAlerts' auto-print,
 * so the two never drift apart.
 *
 * @param {import('../types').OrderLineCard} card
 * @param {{ status: string, characteristic: object|null }} printer usePrinterStore's relevant fields
 */
export function printCard(card, printer) {
  if (printer?.status === 'connected' && printer.characteristic) {
    if (isTestPrinterCharacteristic(printer.characteristic)) {
      usePrinterStore.getState().logTestPrint(card, formatReceiptPreview(card))
      return Promise.resolve()
    }
    return printViaBluetooth(printer.characteristic, card).catch(() => printReceipt(card))
  }
  return Promise.resolve(printReceipt(card))
}
