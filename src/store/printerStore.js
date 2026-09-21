import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useErrorLogStore } from './errorLogStore'

/** A short, good-enough-for-a-local-list unique id — no dependency on `crypto.randomUUID` being present (older WebViews, some test environments). */
export function generatePrinterId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `printer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Live Bluetooth printer connection. `device`/`characteristic` are real
 * GATT objects (not serializable, and not valid after a reload anyway —
 * Web Bluetooth has no silent auto-reconnect, pairing always needs a
 * fresh user gesture), so only `deviceName`/`serviceLabel` are persisted,
 * purely so the Config screen can show "last paired: X" as a hint.
 *
 * `printers` is the saved multi-printer list (Settings → Receipt Printer):
 * each entry is either
 *   { id, name, type: 'network', host, port, secure, printer? }
 *     — `host`/`port`/`secure` address a printer-bridge process (see
 *     src/lib/networkPrinter.js and printer-bridge/); `printer` is the
 *     optional printer name to select when that one bridge process is
 *     itself relaying to several physical printers (see
 *     printer-bridge/README.md's "Multiple printers" section) — leave it
 *     blank for a bridge that only relays to one.
 *   { id, name, type: 'bluetooth' }
 *     — just a label. Web Bluetooth has no silent reconnect, so "using"
 *     one of these still opens the browser's device chooser every time;
 *     the saved entry exists so it can be picked from a list instead of
 *     re-describing the printer from scratch.
 * `activePrinterId` points at whichever of these the live connection
 * above (if any) belongs to — null when connected ad hoc (e.g. "Use Test
 * Printer") or not connected at all.
 */
export const usePrinterStore = create(
  persist(
    (set, get) => ({
      status: 'idle', // idle | connecting | connected | error
      // Which method `status` currently describes. null until the first
      // successful connect. 'bluetooth' and 'test' are also inferable from
      // `characteristic` (a GATT object vs. the TEST_PRINTER symbol) for
      // backwards compatibility, but 'network' has no characteristic at
      // all, so this field is the one source of truth printCard.js and the
      // UI actually branch on.
      connectionType: null, // null | 'bluetooth' | 'network' | 'test'
      deviceName: null,
      serviceLabel: null,
      error: null,
      device: null,
      characteristic: null,

      // Saved printer profiles — see the module doc comment above.
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

      // `printerId` is the saved profile (see `printers` above) this
      // connection belongs to — null for an ad hoc pair not tied to any
      // saved entry (e.g. the Test Printer).
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

      // Network "connecting" reuses setConnecting() above (same generic
      // status), so this only records the eventual success.
      setNetworkConnected: (printerId) =>
        set({
          status: 'connected',
          connectionType: 'network',
          device: null,
          characteristic: null,
          activePrinterId: printerId,
          error: null,
        }),

      // Every printer error funnels through here, so logging it once here
      // (rather than at each call site) covers pairing failures, test
      // print failures, etc. automatically — see the Error Log page
      // (Settings → Error Log, errorLogStore.js).
      setError: (message) => {
        useErrorLogStore.getState().logError({ category: 'printer', message })
        set({ status: 'error', error: message })
      },

      disconnect: () => {
        try {
          get().device?.gatt?.disconnect()
        } catch {
          // already disconnected — nothing to do
        }
        // Leaves deviceName/serviceLabel, `printers`, and `activePrinterId`
        // alone on purpose — whichever method this was, the saved profile
        // is still right there ready for one-click reconnect.
        set({ status: 'idle', connectionType: null, device: null, characteristic: null, error: null })
      },

      // The printer itself dropped the connection (out of range, powered
      // off, etc.) — same end state as disconnect(), but without trying
      // to call .disconnect() again on an already-gone GATT server.
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
      // v1 stored a single network profile as flat networkHost/networkPort/
      // networkSecure fields (plus now-removed Android Print Helper
      // fields). v2 replaces that with the `printers` list, so anyone
      // upgrading keeps their already-working bridge address as the first
      // saved (and active) profile, instead of losing it.
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

/** The saved profile the live connection (if any) belongs to — null when connected ad hoc or not connected. Returns the same object reference across renders whenever `printers`/`activePrinterId` haven't changed, so it's safe to use directly as a selector. */
export function useActivePrinter() {
  return usePrinterStore((s) => s.printers.find((p) => p.id === s.activePrinterId) || null)
}
