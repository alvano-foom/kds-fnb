import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_ENTRIES = 200

// Same local calendar day (not a rolling 24h), so a tablet left on for days only keeps today's entries.
function isToday(isoString) {
  return new Date(isoString).toDateString() === new Date().toDateString()
}

/** Persisted log of background failures (e.g. printing); keeps only today's entries. */
export const useErrorLogStore = create(
  persist(
    (set) => ({
      entries: [],

      /** @param {{ category: string, message: string, detail?: string|null }} entry category is a badge tag, e.g. "printer" */
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
      // Drops yesterday's entries on rehydrate, before the first render.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        entries: (persistedState?.entries ?? []).filter((e) => isToday(e.at)),
      }),
    },
  ),
)
