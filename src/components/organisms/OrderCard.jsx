import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { OrderMeta } from '../molecules/OrderMeta'
import { Badge } from '../atoms/Badge'

// One card = one order line (kitchen_state lives on the line, not the
// order), tagged with the table number from the parent order's
// client_order_ref so kitchen staff know where it goes.
function OrderCardImpl({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      className={`cursor-grab touch-none rounded-lg border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? 'z-10 opacity-50 shadow-md' : ''
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{card.order_name}</span>
        {card.table_number && <Badge tone="accent">Table {card.table_number}</Badge>}
      </div>
      <p className="mb-2 text-sm text-gray-700">
        {card.qty}× {card.product_name}
        {card.note && <span className="block text-xs text-gray-400">{card.note}</span>}
      </p>
      <OrderMeta customerName={card.customer_name} createdAt={card.created_at} />
    </div>
  )
}

// Re-render this card only if its own data changed, not when a sibling
// card in the same column (or another column) does.
export const OrderCard = memo(
  OrderCardImpl,
  (prev, next) => prev.card.id === next.card.id && prev.card.updated_at === next.card.updated_at,
)
