// A live-ticking clock is skipped here (ponytail: not asked for, and the
// board already re-renders often from WS events / query refetches which
// keeps this close enough) — add a 30s interval tick if it's ever needed.
function elapsed(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(ms / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

export function OrderMeta({ customerName, createdAt }) {
  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>{customerName}</span>
      <span>{elapsed(createdAt)}</span>
    </div>
  )
}
