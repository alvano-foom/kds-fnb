import { useDroppable } from '@dnd-kit/core'
import { OrderCard } from './OrderCard'
import { StatusDot } from '../atoms/StatusDot'
import { KITCHEN_STATE_LABELS } from '../../types'

const COLUMN_DOT = { pending: 'blue', cooking: 'orange', ready: 'green', served: 'gray' }

export function KanbanColumn({ state, cards }) {
  const { setNodeRef, isOver } = useDroppable({ id: state })

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <StatusDot color={COLUMN_DOT[state]} />
          {KITCHEN_STATE_LABELS[state]}
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
          {cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-3 overflow-y-auto p-3 transition-colors ${isOver ? 'bg-brand/10' : ''}`}
      >
        {cards.length === 0 && <p className="pt-8 text-center text-sm text-gray-400">No orders</p>}
        {cards.map((card) => (
          <OrderCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
