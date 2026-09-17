import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ErrorLog } from './ErrorLog'
import { useErrorLogStore } from '../../store/errorLogStore'

describe('ErrorLog', () => {
  it('shows an empty state with troubleshooting guidance when nothing has been logged', () => {
    render(<ErrorLog />)
    expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clear log/i })).not.toBeInTheDocument()
  })

  it('lists logged entries newest first, with category, message, and detail', () => {
    useErrorLogStore.getState().logError({ category: 'printer', message: 'Could not connect to the printer.' })
    useErrorLogStore
      .getState()
      .logError({ category: 'printer', message: 'Bluetooth print failed for SO0231.', detail: 'printer out of range' })

    render(<ErrorLog />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Bluetooth print failed for SO0231.')
    expect(items[0]).toHaveTextContent('printer out of range')
    expect(items[0]).toHaveTextContent('Printer')
    expect(items[1]).toHaveTextContent('Could not connect to the printer.')
  })

  it('clears the log', async () => {
    useErrorLogStore.getState().logError({ category: 'printer', message: 'Could not connect to the printer.' })
    const user = userEvent.setup()
    render(<ErrorLog />)

    await user.click(screen.getByRole('button', { name: /clear log/i }))

    expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument()
    expect(useErrorLogStore.getState().entries).toEqual([])
  })

  it('prunes entries from a previous day as soon as the page is opened, even with no new error logged', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    useErrorLogStore.setState({ entries: [{ id: 'old', category: 'printer', message: 'stale', detail: null, at: yesterday }] })

    render(<ErrorLog />)

    expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument()
    expect(useErrorLogStore.getState().entries).toEqual([])
  })
})
