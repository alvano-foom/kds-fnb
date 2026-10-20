import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * How the board and the tickets slice an order (Settings → Board & Tickets):
 *
 *  - `perTransaction: false` (the original behaviour): one board card and one
 *    ticket per sale.order LINE.
 *  - `perTransaction: true`: one board card and one ticket per transaction,
 *    i.e. per sale.order, with all of its lines listed on it.
 *
 * Whether tickets print *automatically* is still the separate "Automatically
 * print each new order" switch under Receipt Printer (printerStore.autoPrint);
 * this setting only decides what one card / one ticket stands for.
 */
export const useOrderViewStore = create(
  persist(
    (set) => ({
      perTransaction: false,
      setPerTransaction: (perTransaction) => set({ perTransaction: Boolean(perTransaction) }),
    }),
    { name: 'kds_order_view', partialize: (s) => ({ perTransaction: s.perTransaction }) },
  ),
)
