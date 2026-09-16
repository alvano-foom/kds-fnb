import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginForm } from './LoginForm'

function renderWithClient(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('LoginForm', () => {
  it('shows one generic error on invalid credentials', async () => {
    const user = userEvent.setup()
    renderWithClient(<LoginForm onSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText('Email'), 'wrong@example.com')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument()
  })

  it('calls onSuccess with valid Odoo credentials', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    renderWithClient(<LoginForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email'), 'staff@kawahputih.test')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })
})
