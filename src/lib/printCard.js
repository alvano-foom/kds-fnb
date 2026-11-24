import { printReceipt } from './receipt'
import { formatReceiptPreview, isTestPrinterCharacteristic, printViaBluetooth } from './printer'
import { printViaNetwork } from './networkPrinter'
import { usePrinterStore } from '@/store/printerStore'
import { useErrorLogStore } from '@/store/errorLogStore'

function logFallback(card, transport, err) {
  useErrorLogStore.getState().logError({
    category: 'printer',
    message: `${transport} print failed for ${card.order_name ?? card.id ?? 'an order'} — fell back to the print dialog.`,
    detail: err?.message ?? String(err),
  })
  return printReceipt(card)
}

/**
 * Prints one ticket via the connected printer (test, network, or Bluetooth),
 * falling back to the browser print dialog when none is connected or the print fails.
 *
 * @param {import('@/types').OrderLineCard} card
 * @param {{ status: string, connectionType?: string|null, characteristic?: object|null, activePrinter?: { host?: string, port?: string|number, secure?: boolean, printer?: string }|null }} printer
 *   printerStore state plus the active saved printer profile (network host/port come from it)
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
