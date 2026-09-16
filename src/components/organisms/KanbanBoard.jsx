import { DndContext, closestCenter } from '@dnd-kit/core'
import { KanbanColumn } from './KanbanColumn'
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
  function handleDragEnd({ active, over }) {
    const result = resolveDrop(cards, active.id, over?.id)
    if (result) onDrop(result.lineId, result.kitchenState)
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KITCHEN_STATES.map((state) => (
          <KanbanColumn key={state} state={state} cards={cards.filter((c) => c.kitchen_state === state)} />
        ))}
      </div>
    </DndContext>
  )
}
