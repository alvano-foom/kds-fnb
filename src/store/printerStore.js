import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useErrorLogStore } from './errorLogStore'

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
      // Which of the three printing methods `status` currently describes.
      // null until the first successful connect. 'bluetooth' and 'test'
      // are also inferable from `characteristic` (a GATT object vs. the
      // TEST_PRINTER symbol) for backwards compatibility, but 'network'
      // has no characteristic at all, so this field is the one source of
      // truth printCard.js and the UI actually branch on.
      connectionType: null, // null | 'bluetooth' | 'network' | 'android' | 'test'
      deviceName: null,
      serviceLabel: null,
      error: null,
      device: null,
      characteristic: null,

      // Printer bridge host/port for the "Network Printer (IP address)"
      // option — see src/lib/networkPrinter.js and printer-bridge/ for
      // why a bridge is needed at all. Persisted (unlike Bluetooth's
      // device/characteristic) because there's no GATT permission to
      // re-grant and no user gesture required to reconnect: it's just a
      // remembered address, reachable again with one click of "Connect".
      networkHost: '',
      networkPort: '8008',
      networkSecure: false,
      setNetworkHost: (networkHost) => set({ networkHost }),
      setNetworkPort: (networkPort) => set({ networkPort }),
      setNetworkSecure: (networkSecure) => set({ networkSecure }),

      // "Android Print Helper" — hands tickets to a native companion app
      // (printer-service-main) on THIS SAME tablet via a kdsprint://
      // intent, instead of the browser talking to the printer itself. See
      // src/lib/androidPrintBridge.js. Two transports the companion app
      // supports: 'bluetooth' (classic/SPP, e.g. the iWare RPP02N, which
      // Web Bluetooth can never see at all) or 'network' (a raw socket,
      // opened natively on the tablet — no separate bridge computer).
      androidTransport: 'bluetooth', // 'bluetooth' | 'network'
      androidMac: '',
      androidHost: '',
      androidPort: '9100',
      setAndroidTransport: (androidTransport) => set({ androidTransport }),
      setAndroidMac: (androidMac) => set({ androidMac }),
      setAndroidHost: (androidHost) => set({ androidHost }),
      setAndroidPort: (androidPort) => set({ androidPort }),

      // No handshake to make here — unlike Bluetooth pairing or the
      // network bridge's reachability check, there's nothing this browser
      // can verify about a native app on the same device before printing
      // is actually attempted (see androidPrintBridge.js: the print call
      // itself is fire-and-forget, with no success/failure reported back).
      // So "Connect" just records the chosen config as active, the same
      // instant way the Test Printer does.
      setAndroidConnected: () =>
        set({
          status: 'connected',
          connectionType: 'android',
          device: null,
          characteristic: null,
          error: null,
        }),

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

      setConnected: ({ device, characteristic, serviceLabel, connectionType = 'bluetooth' }) =>
        set({
          status: 'connected',
          connectionType,
          device,
          characteristic,
          serviceLabel,
          deviceName: device.name || 'Printer',
          error: null,
        }),

      // Network "connecting" reuses setConnecting() above (same generic
      // status), so this only records the eventual success — deliberately
      // does NOT touch deviceName/serviceLabel, which stay dedicated to
      // Bluetooth's own "last paired: X" reconnect hint (see PrinterConfig).
      setNetworkConnected: () =>
        set({
          status: 'connected',
          connectionType: 'network',
          device: null,
          characteristic: null,
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
        // Leaves deviceName/serviceLabel and networkHost/networkPort/
        // networkSecure alone on purpose, same reasoning as Bluetooth's
        // existing "last paired" hint: whichever method this was, the
        // config is still right there ready for one-click reconnect.
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
      partialize: (state) => ({
        deviceName: state.deviceName,
        serviceLabel: state.serviceLabel,
        autoPrint: state.autoPrint,
        networkHost: state.networkHost,
        networkPort: state.networkPort,
        networkSecure: state.networkSecure,
        androidTransport: state.androidTransport,
        androidMac: state.androidMac,
        androidHost: state.androidHost,
        androidPort: state.androidPort,
      }),
    },
  ),
)
