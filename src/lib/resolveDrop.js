/** Kept out of the DnD handler so it is unit-testable without simulating pointer gestures. */
export function resolveDrop(cards, activeId, overId) {
  if (!overId) return null
  const card = cards.find((c) => c.id === activeId)
  if (!card || card.kitchen_state === overId) return null
  return { lineId: activeId, kitchenState: overId }
}
