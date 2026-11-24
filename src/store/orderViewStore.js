import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** perTransaction: one board card and one ticket per sale.order instead of per order line. */
export const useOrderViewStore = create(
  persist(
    (set) => ({
      perTransaction: false,
      setPerTransaction: (perTransaction) => set({ perTransaction: Boolean(perTransaction) }),
    }),
    { name: 'kds_order_view', partialize: (s) => ({ perTransaction: s.perTransaction }) },
  ),
)
