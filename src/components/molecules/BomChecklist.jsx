import { checklistProgress, consumedQty, isShort } from '../../lib/bom'

/**
 * The kitchen operator's pre-flight todo: every ingredient the BoM says
 * this run will consume, scaled to the qty being made, each with a
 * checkbox. The ticks are purely a human aid ("yes, I have it out and
 * measured") — they are NOT sent to the backend and never validated by
 * it; the only thing they gate is the Create button in ProductionForm,
 * which stays disabled until progress hits 100%.
 *
 * `available_qty` (when the backend provides it) only drives an amber
 * "short" hint — it does not block anything, since the real authority on
 * whether the MO can finish is Odoo itself (409 done_failed).
 */
export function BomChecklist({ bom, qty, checked, onToggle }) {
  const total = bom.components.length
  const progress = checklistProgress(total, checked.size)

  if (total === 0) {
    return <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">This BoM has no components to check.</p>
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>
            Ingredients checked: <strong className="text-gray-700">{progress.done}</strong> of {progress.total}
          </span>
          <span>{progress.percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Ingredients checked"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          className="h-1.5 overflow-hidden rounded-full bg-gray-100"
        >
          <div className="h-full bg-brand transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {bom.components.map((c) => {
          const consumed = consumedQty(c, bom.output_qty, qty)
          const short = isShort(c, bom.output_qty, qty)
          const isChecked = checked.has(c.product_id)
          return (
            <li key={c.product_id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(c.product_id)}
                  aria-label={`${c.name} — consumed ${consumed} ${c.uom}`}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand focus:ring-brand/20"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${isChecked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {c.name}
                  </span>
                  <span className="block text-xs text-gray-500">
                    Consumed: <strong className="text-gray-700">{consumed} {c.uom}</strong>
                    {c.available_qty != null && <span className="text-gray-400"> · {c.available_qty} {c.uom} on hand</span>}
                  </span>
                  {short && (
                    <span className="mt-0.5 block text-xs font-medium text-amber-700">
                      Short — only {c.available_qty} {c.uom} on hand
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
