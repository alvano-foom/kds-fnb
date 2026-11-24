import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useErrorLogStore } from './errorLogStore'

/** Falls back when crypto.randomUUID is missing (older WebViews, some test environments). */
export function generatePrinterId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `printer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Live printer connection plus saved printer profiles.
 * GATT objects can't be persisted (and Web Bluetooth can't silently reconnect), so only labels are.
 * Profiles: { id, name, type: 'network', host, port, secure, printer? } | { id, name, type: 'bluetooth' }.
 * `activePrinterId` is the profile the live connection belongs to; null when ad hoc or disconnected.
 */
export const usePrinterStore = create(
  persist(
    (set, get) => ({
      status: 'idle', // idle | connecting | connected | error
      // Source of truth for routing; 'network' has no characteristic to infer it from.
      connectionType: null, // null | 'bluetooth' | 'network' | 'test'
      deviceName: null,
      serviceLabel: null,
      error: null,
      device: null,
      characteristic: null,

      printers: [],
      activePrinterId: null,
      savePrinter: (profile) =>
        set((s) => {
          const exists = s.printers.some((p) => p.id === profile.id)
          return {
            printers: exists ? s.printers.map((p) => (p.id === profile.id ? profile : p)) : [...s.printers, profile],
          }
        }),
      removePrinter: (id) =>
        set((s) => ({
          printers: s.printers.filter((p) => p.id !== id),
          activePrinterId: s.activePrinterId === id ? null : s.activePrinterId,
        })),
      setActivePrinterId: (activePrinterId) => set({ activePrinterId }),

      // Read by PendingOrderAlerts: print each card as it newly enters "pending".
      autoPrint: false,
      setAutoPrint: (autoPrint) => set({ autoPrint }),

      // Session-only output of the simulated Test Printer, newest first, capped.
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

      setConnected: ({ device, characteristic, serviceLabel, connectionType = 'bluetooth', printerId = null }) =>
        set({
          status: 'connected',
          connectionType,
          device,
          characteristic,
          serviceLabel,
          deviceName: device.name || 'Printer',
          activePrinterId: printerId,
          error: null,
        }),

      setNetworkConnected: (printerId) =>
        set({
          status: 'connected',
          connectionType: 'network',
          device: null,
          characteristic: null,
          activePrinterId: printerId,
          error: null,
        }),

      // Every printer error funnels through here, so this is the one place it gets logged.
      setError: (message) => {
        useErrorLogStore.getState().logError({ category: 'printer', message })
        set({ status: 'error', error: message })
      },

      disconnect: () => {
        try {
          get().device?.gatt?.disconnect()
        } catch {
          // already disconnected
        }
        // Saved profiles and the active id stay, for one-click reconnect.
        set({ status: 'idle', connectionType: null, device: null, characteristic: null, error: null })
      },

      // Printer dropped the link itself; don't call disconnect() on a gone GATT server.
      handleUnexpectedDisconnect: () => {
        const name = get().deviceName
        useErrorLogStore.getState().logError({
          category: 'printer',
          message: `Printer disconnected unexpectedly${name ? ` (${name})` : ''}.`,
        })
        set({ status: 'idle', device: null, characteristic: null })
      },
    }),
    {
      name: 'kds_printer',
      version: 2,
      // v1 had one flat network profile; carry it over as the first saved, active printer.
      migrate: (persisted, version) => {
        if (version >= 2) return persisted
        const printers = []
        if (persisted?.networkHost) {
          printers.push({
            id: 'migrated-network',
            name: 'Network Printer',
            type: 'network',
            host: persisted.networkHost,
            port: persisted.networkPort || '8008',
            secure: Boolean(persisted.networkSecure),
            printer: '',
          })
        }
        return {
          ...persisted,
          printers,
          activePrinterId: printers[0]?.id ?? null,
        }
      },
      partialize: (state) => ({
        deviceName: state.deviceName,
        serviceLabel: state.serviceLabel,
        autoPrint: state.autoPrint,
        printers: state.printers,
        activePrinterId: state.activePrinterId,
      }),
    },
  ),
)

/** Saved profile of the live connection, or null. Stable reference, safe as a selector. */
export function useActivePrinter() {
  return usePrinterStore((s) => s.printers.find((p) => p.id === s.activePrinterId) || null)
}
