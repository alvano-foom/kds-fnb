import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_ENTRIES = 200

// Same local calendar day, not "within the last 24 hours" — a KDS tablet
// commonly stays on for days, so a fixed rolling window would still let
// entries pile up indefinitely. Comparing local toDateString() means the
// log always holds only today's entries, in whatever timezone this
// device is actually in.
function isToday(isoString) {
  return new Date(isoString).toDateString() === new Date().toDateString()
}

/**
 * A small history of things that went wrong, for the Error Log page
 * (Settings → Error Log) — built so a printer that silently stopped
 * printing (or any other background failure) leaves a trace someone can
 * check later, not just an error that flashed by once. Persisted to
 * localStorage so it survives a reload/reopen, unlike the Test Printer's
 * session-only output log in printerStore.
 *
 * Entries only ever live for the calendar day they happened on — kept
 * short on purpose so this can't quietly turn into an ever-growing spam
 * log on a device that's rarely restarted. Old entries are dropped: on
 * every new log (logError), on app start/reopen (the persist `merge`
 * below, which runs as soon as yesterday's localStorage data loads), and
 * whenever the Error Log page is actually open (ErrorLog.jsx calls
 * pruneOldEntries() on mount, for a tab left open across midnight).
 */
export const useErrorLogStore = create(
  persist(
    (set) => ({
      entries: [],

      /**
       * @param {{ category: string, message: string, detail?: string|null }} entry
       *   category is a short source tag shown as a badge, e.g. "printer".
       *   message is the main line; detail is optional extra context
       *   (e.g. the underlying error's own message) shown smaller below it.
       */
      logError: ({ category, message, detail = null }) =>
        set((s) => ({
          entries: [
            { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, category, message, detail, at: new Date().toISOString() },
            ...s.entries.filter((e) => isToday(e.at)),
          ].slice(0, MAX_ENTRIES),
        })),

      pruneOldEntries: () => set((s) => ({ entries: s.entries.filter((e) => isToday(e.at)) })),

      clear: () => set({ entries: [] }),
    }),
    {
      name: 'kds_error_log',
      // Runs synchronously as the persisted state is loaded back in, so
      // yesterday's entries are gone before the very first render — not
      // just once someone happens to log a new error or open the page.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        entries: (persistedState?.entries ?? []).filter((e) => isToday(e.at)),
      }),
    },
  ),
)
