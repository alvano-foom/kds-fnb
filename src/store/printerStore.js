import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Live Bluetooth printer connection. `device`/`characteristic` are real
 * GATT objects (not serializable, and not valid after a reload anyway —
 * Web Bluetooth has no silent auto-reconnect, pairing always needs a
 * fresh user gesture), so only `deviceName`/`serviceLabel` are persisted,
 * purely so the Config screen can show "last paired: X" as a hint.
 */
export const usePrinterStore = create(
  persist(
    (set, get) => ({
      status: 'idle', // idle | connecting | connected | error
      deviceName: null,
      serviceLabel: null,
      error: null,
      device: null,
      characteristic: null,

      // Off by default (matches the original manual-only design): a card
      // only prints when someone clicks its Print button. Turning this on
      // prints every card the moment it newly enters "pending" — the same
      // event that triggers the toast/voice announcement in
      // PendingOrderAlerts.jsx, which is also where this flag is read.
      autoPrint: false,
      setAutoPrint: (autoPrint) => set({ autoPrint }),

      // What the simulated Test Printer has "printed" this session — never
      // persisted, purely a live on-screen log so pairing/printing can be
      // verified without real hardware. Newest first, capped so it can't
      // grow without bound.
      testPrints: [],
      logTestPrint: (card, preview) =>
        set((s) => ({
          testPrints: [{ id: `${card.id ?? 'test'}-${Date.now()}`, preview, printedAt: new Date().toISOString() }, ...s.testPrints].slice(
            0,
            20,
          ),
        })),
      clearTestPrints: () => set({ testPrints: [] }),

      setConnecting: () => set({ status: 'connecting', error: null }),

      setConnected: ({ device, characteristic, serviceLabel }) =>
        set({
          status: 'connected',
          device,
          characteristic,
          serviceLabel,
          deviceName: device.name || 'Printer',
          error: null,
        }),

      setError: (message) => set({ status: 'error', error: message }),

      disconnect: () => {
        try {
          get().device?.gatt?.disconnect()
        } catch {
          // already disconnected — nothing to do
        }
        set({ status: 'idle', device: null, characteristic: null, error: null })
      },

      // The printer itself dropped the connection (out of range, powered
      // off, etc.) — same end state as disconnect(), but without trying
      // to call .disconnect() again on an already-gone GATT server.
      handleUnexpectedDisconnect: () => set({ status: 'idle', device: null, characteristic: null }),
    }),
    {
      name: 'kds_printer',
      partialize: (state) => ({
        deviceName: state.deviceName,
        serviceLabel: state.serviceLabel,
        autoPrint: state.autoPrint,
      }),
    },
  ),
)
