import { useState } from 'react'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { OrderCardOverlay } from './OrderCard'
import { KITCHEN_STATES } from '@/types'
import { resolveDrop } from '@/lib/resolveDrop'

/** @param {import('@/types').OrderLineCard[]} cards one card per order line */
export function KanbanBoard({ cards, onDrop }) {
  // The dragged card is rendered in the DragOverlay, since a column's overflow-y-auto clips it.
  const [activeId, setActiveId] = useState(null)
  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    const result = resolveDrop(cards, active.id, over?.id)
    if (result) onDrop(result.lineId, result.kitchenState)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KITCHEN_STATES.map((state) => (
          <KanbanColumn key={state} state={state} cards={cards.filter((c) => c.kitchen_state === state)} />
        ))}
      </div>
      <DragOverlay>{activeCard ? <OrderCardOverlay card={activeCard} /> : null}</DragOverlay>
    </DndContext>
  )
}
