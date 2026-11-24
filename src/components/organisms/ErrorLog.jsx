import { useEffect } from 'react'
import { Badge } from '@/components/atoms/Badge'
import { useErrorLogStore } from '@/store/errorLogStore'

const CATEGORY_LABELS = {
  printer: 'Printer',
}

/** Today's background errors (mostly printing). Prunes on mount in case the page stayed open past midnight. */
export function ErrorLog() {
  const { entries, clear } = useErrorLogStore()

  useEffect(() => {
    useErrorLogStore.getState().pruneOldEntries()
  }, [])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {entries.length} logged
        </span>
        {entries.length > 0 && (
          <button type="button" onClick={clear} className="text-xs font-medium text-gray-400 underline">
            Clear log
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing logged yet — this fills in when something goes wrong, like a printer that won't
          pair or a ticket that failed to print over Bluetooth. If a printer isn't printing and
          nothing shows up here, the problem is likely upstream of that print attempt — check that
          a printer is paired at all in Settings → Receipt Printer.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge tone="warning">{CATEGORY_LABELS[entry.category] ?? entry.category}</Badge>
                <span className="text-xs text-gray-400">{new Date(entry.at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-800">{entry.message}</p>
              {entry.detail && <p className="mt-0.5 font-mono text-xs text-gray-400">{entry.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
