import { beforeEach, describe, expect, it, vi } from 'vitest'
import { printReceipt } from './receipt'

const card = {
  id: 'l4',
  order_name: 'SO0229',
  table_number: '12',
  customer_name: 'Claire',
  product_name: 'Chicken Satay',
  qty: 3,
  kitchen_state: 'cooking',
}

function fakeWindow() {
  return {
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
  }
}

describe('printReceipt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('writes a ticket with the order, table, and line item into a new window and prints it', () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win)

    printReceipt(card)
    vi.runAllTimers()

    expect(win.document.write).toHaveBeenCalledOnce()
    const html = win.document.write.mock.calls[0][0]
    expect(html).toContain('SO0229')
    expect(html).toContain('TABLE 12')
    expect(html).toContain('3×')
    expect(html).toContain('Chicken Satay')
    expect(win.print).toHaveBeenCalledOnce()
  })

  it('does nothing when the popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(printReceipt(card)).toBe(false)
  })

  it('escapes HTML in card fields so a stray value can\'t break the ticket markup', () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win)

    printReceipt({ ...card, product_name: '<script>alert(1)</script>' })
    vi.runAllTimers()

    const html = win.document.write.mock.calls[0][0]
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
