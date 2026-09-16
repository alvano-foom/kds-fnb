import { StatusDot } from '../atoms/StatusDot'

const STATUS_META = {
  connected: { color: 'green', label: 'Connected' },
  connecting: { color: 'blue', label: 'Connecting…' },
  reconnecting: { color: 'orange', label: 'Reconnecting…' },
  polling: { color: 'orange', label: 'Polling mode' },
}

export function ConnectionStatus({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.connecting
  return (
    <div className="inline-flex items-center gap-2 text-sm text-brand-contrast/90">
      <StatusDot color={meta.color} />
      {meta.label}
    </div>
  )
}
