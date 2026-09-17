import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { OrderMeta } from '../molecules/OrderMeta'
import { Badge } from '../atoms/Badge'
import { printReceipt } from '../../lib/receipt'

const PrinterIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" {...props}>
    <path d="M5.5 7V3.5h9V7M5.5 15.5h9V12h-9v3.5ZM3.5 7h13a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1H15v-2H5v2H3.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
  </svg>
)

// Shared between the in-place card and its DragOverlay clone so the two
// never drift apart visually.
function CardContents({ card }) {
  return (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{card.order_name}</span>
        {card.table_number && <Badge tone="accent">Table {card.table_number}</Badge>}
      </div>
      <p className="mb-2 text-sm text-gray-700">
        {card.qty}× {card.product_name}
        {card.note && <span className="block text-xs text-gray-400">{card.note}</span>}
      </p>
      <OrderMeta customerName={card.customer_name} createdAt={card.created_at} />
    </>
  )
}

// Rendered inside <DragOverlay> (see KanbanBoard) — a plain visual clone
// with no drag listeners of its own; dnd-kit portals it to <body> and
// positions it under the pointer. Because it's outside every column, it's
// never clipped by a column's overflow-y-auto the way the in-place card
// would be if it tried to translate itself across column boundaries.
export function OrderCardOverlay({ card }) {
  return (
    <div
      style={{ width: 280 }}
      className="rotate-2 cursor-grabbing rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
    >
      <CardContents card={card} />
    </div>
  )
}

// One card = one order line (kitchen_state lives on the line, not the
// order), tagged with the table number from the parent order's
// client_order_ref so kitchen staff know where it goes.
function OrderCardImpl({ card }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id })

  // While dragging, this element stays put as a dashed placeholder marking
  // the origin slot — the actual moving card is the DragOverlay clone
  // above, which can float over every column instead of being clipped by
  // whichever one it started in.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      className={`touch-none rounded-lg border p-3 transition-colors ${
        isDragging
          ? 'cursor-grabbing border-dashed border-gray-300 bg-gray-50'
          : 'cursor-grab border-gray-200 bg-white shadow-sm active:cursor-grabbing'
      }`}
    >
      <div className={isDragging ? 'invisible' : undefined}>
        <CardContents card={card} />
        <button
          type="button"
          // Stop the pointer event before it reaches this card's own
          // dnd-kit listeners (spread on the parent div above) — without
          // this, pressing the button starts a drag instead of a click.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            printReceipt(card)
          }}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-brand"
        >
          <PrinterIcon /> Print
        </button>
      </div>
    </div>
  )
}

// Re-render this card only if its own data changed, not when a sibling
// card in the same column (or another column) does.
export const OrderCard = memo(
  OrderCardImpl,
  (prev, next) => prev.card.id === next.card.id && prev.card.updated_at === next.card.updated_at,
)
