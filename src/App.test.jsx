import { describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// End-to-end (through the mock backend) coverage of the real contract:
// unconfigured device -> Settings -> sign in (whoami) -> open kitchen
// (company-wide, not per-employee) -> create + auto-done a production ->
// blocked close while scrap is missing -> scrap entry -> close succeeds.

async function configureDevice(user) {
  render(<App />)
  await user.click(await screen.findByRole('button', { name: /open device settings/i }))
  await user.click(screen.getByRole('button', { name: /use demo\/mock values/i }))
  await user.click(screen.getByRole('button', { name: /^save$/i }))
}

describe('kitchen production — full flow against the real contract shape', () => {
  test('an unconfigured device shows the settings gate first', async () => {
    render(<App />)
    expect(await screen.findByText(/set up this device/i)).toBeInTheDocument()
  })

  test('rejects an unknown Kode Absensi after the device is configured', async () => {
    const user = userEvent.setup()
    await configureDevice(user)
    await user.type(await screen.findByLabelText(/kode absensi/i), 'BADCODE')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/not recognized/i)).toBeInTheDocument()
  })

  test('sign in -> open kitchen -> create MO (auto-done) -> blocked close -> scrap -> close', async () => {
    const user = userEvent.setup()
    await configureDevice(user)

    await user.type(await screen.findByLabelText(/kode absensi/i), 'F102345')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Bisma Fauzan')).toBeInTheDocument()
    expect(screen.getByText(/kitchen isn't open yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /open kitchen/i }))
    expect(await screen.findByText(/open$/i)).toBeInTheDocument() // the "Open" status pill

    await user.type(screen.getByLabelText(/product to manufacture/i), 'nasi')
    await user.click(await screen.findByText('Nasi Goreng Spesial'))
    await user.type(screen.getByLabelText(/quantity to manufacture/i), '10')
    await user.click(screen.getByRole('button', { name: /create manufacturing order/i }))

    expect(await screen.findByText(/created and marked done/i)).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /close kitchen/i }))
    const scrapInput = await screen.findByLabelText(/scrap qty for/i)
    const confirmClose = screen.getByRole('button', { name: /confirm & close kitchen/i })
    expect(confirmClose).toBeDisabled()

    await user.type(scrapInput, '0.5')
    expect(confirmClose).not.toBeDisabled()
    await user.click(confirmClose)

    await waitFor(() => expect(screen.getByText(/kitchen isn't open yet/i)).toBeInTheDocument())
  })

  test('a second employee joins the already-open kitchen instead of opening a second one', async () => {
    const user = userEvent.setup()
    await configureDevice(user)

    await user.type(await screen.findByLabelText(/kode absensi/i), 'F102345')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await user.click(await screen.findByRole('button', { name: /open kitchen/i }))
    expect(await screen.findByText(/opened by bisma fauzan/i)).toBeInTheDocument()

    // Switch operator without closing the kitchen.
    await user.click(screen.getByRole('button', { name: /switch/i }))
    await user.type(await screen.findByLabelText(/kode absensi/i), 'F100120')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Straight to the working screen — no "Open Kitchen" button shown again.
    expect(await screen.findByText(/opened by bisma fauzan/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^open kitchen$/i })).not.toBeInTheDocument()
  })

  test('a product with no Bill of Materials cannot be turned into a production', async () => {
    const user = userEvent.setup()
    await configureDevice(user)
    await user.type(await screen.findByLabelText(/kode absensi/i), 'F102345')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await user.click(await screen.findByRole('button', { name: /open kitchen/i }))

    await user.type(await screen.findByLabelText(/product to manufacture/i), 'teh')
    await user.click(await screen.findByText('Es Teh Manis'))
    await user.type(screen.getByLabelText(/quantity to manufacture/i), '5')
    await user.click(screen.getByRole('button', { name: /create manufacturing order/i }))

    expect(await screen.findByText(/no bill of materials/i)).toBeInTheDocument()
  })
})
