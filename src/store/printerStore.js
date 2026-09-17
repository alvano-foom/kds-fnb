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
      partialize: (state) => ({ deviceName: state.deviceName, serviceLabel: state.serviceLabel }),
    },
  ),
)
