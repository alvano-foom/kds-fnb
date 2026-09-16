import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KanbanBoard, resolveDrop } from './KanbanBoard'

const now = new Date().toISOString()
// Two lines from the SAME order (SO01), one pending one cooking — this is
// the whole point of line-level kitchen_state: an order can straddle columns.
const cards = [
  { id: 'l1', order_id: 'o1', order_name: 'SO01', table_number: '7', customer_name: 'Alex', product_name: 'Fried Rice', qty: 2, kitchen_state: 'pending', created_at: now, updated_at: now },
  { id: 'l2', order_id: 'o1', order_name: 'SO01', table_number: '7', customer_name: 'Alex', product_name: 'Iced Tea', qty: 2, kitchen_state: 'cooking', created_at: now, updated_at: now },
]

describe('resolveDrop', () => {
  it('moves a line to the column it was dropped on', () => {
    expect(resolveDrop(cards, 'l1', 'cooking')).toEqual({ lineId: 'l1', kitchenState: 'cooking' })
  })

  it('is a no-op when dropped back on its own column', () => {
    expect(resolveDrop(cards, 'l1', 'pending')).toBeNull()
  })

  it('is a no-op when there is no drop target', () => {
    expect(resolveDrop(cards, 'l1', undefined)).toBeNull()
  })
})

describe('KanbanBoard', () => {
  it('renders all four columns with lines grouped by kitchen_state, tagged with their table number', () => {
    render(<KanbanBoard cards={cards} onDrop={vi.fn()} />)

    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Cooking')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Served')).toBeInTheDocument()

    expect(screen.getAllByText('SO01')).toHaveLength(2)
    expect(screen.getAllByText('Table 7')).toHaveLength(2)
    expect(screen.getByText(/Fried Rice/)).toBeInTheDocument()
    expect(screen.getByText(/Iced Tea/)).toBeInTheDocument()
  })
})
