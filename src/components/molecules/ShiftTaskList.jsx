/**
 * The reminder list for one shift (Odoo's shift tasks), ordered by
 * `sequence`. With `onToggle` it's a tickable checklist; without, a plain
 * read-only preview (used on the "Open Kitchen" screen right after picking
 * a shift). Ticks are a memory aid only — nothing here is validated or
 * sent anywhere.
 */
export function ShiftTaskList({ tasks, doneIds = [], onToggle }) {
  const ordered = [...tasks].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {ordered.map((t) => {
        const done = doneIds.includes(t.id)
        const text = (
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{t.name}</span>
            {t.description && <span className="block text-xs text-gray-500">{t.description}</span>}
          </span>
        )
        return (
          <li key={t.id}>
            {onToggle ? (
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(t.id)}
                  aria-label={t.name}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand/20"
                />
                {text}
              </label>
            ) : (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                {text}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
