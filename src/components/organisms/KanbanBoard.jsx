import { useState } from 'react'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
import { OrderCardOverlay } from './OrderCard'
import { KITCHEN_STATES } from '../../types'

/** Pure decision logic, kept out of the DnD event handler so it's unit-testable without simulating pointer gestures. */
export function resolveDrop(cards, activeId, overId) {
  if (!overId) return null
  const card = cards.find((c) => c.id === activeId)
  if (!card || card.kitchen_state === overId) return null
  return { lineId: activeId, kitchenState: overId }
}

/** @param {import('../../types').OrderLineCard[]} cards one card per order line */
export function KanbanBoard({ cards, onDrop }) {
  // Tracks which card is being dragged so a floating copy of it can be
  // rendered in the DragOverlay below — see OrderCard.jsx for why: a
  // column's overflow-y-auto clips anything that tries to move within the
  // column's own box, so the visible "moving" card has to live outside
  // every column instead.
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
