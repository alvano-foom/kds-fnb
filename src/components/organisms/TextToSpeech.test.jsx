import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TextToSpeech } from './TextToSpeech'
import { useTtsStore } from '../../store/ttsStore'

const voices = [
  { voiceURI: 'v1', name: 'Kitchen Voice', lang: 'en-US' },
  { voiceURI: 'v2', name: 'Alt Voice', lang: 'id-ID' },
]

describe('TextToSpeech', () => {
  beforeEach(() => {
    window.speechSynthesis.getVoices = () => voices
    window.speechSynthesis.speak = vi.fn()
    window.speechSynthesis.cancel = vi.fn()
  })

  it('auto-picks the Indonesian voice and speaks with it, hiding non-Indonesian voices from the list', async () => {
    const user = userEvent.setup()
    render(<TextToSpeech />)

    // Only the Indonesian voice is offered — the non-Indonesian one isn't
    // selected, so it's filtered out of the dropdown entirely.
    expect(screen.getByRole('option', { name: '🇮🇩 Alt Voice (id-ID)' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /kitchen voice/i })).not.toBeInTheDocument()

    const textarea = screen.getByLabelText('Announcement text')
    await user.clear(textarea)
    await user.type(textarea, 'Order 7 is ready.')
    await user.click(screen.getByRole('button', { name: /speak/i }))

    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1)
    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    expect(utterance.text).toBe('Order 7 is ready.')
    expect(utterance.voice).toEqual(voices[1])
  })

  it('previews the template filled in with sample data, not the raw placeholders', async () => {
    const user = userEvent.setup()
    render(<TextToSpeech />)

    const textarea = screen.getByLabelText('Announcement text')
    await user.clear(textarea)
    // userEvent.type treats "{" as the start of a special-key sequence, so
    // paste the literal placeholder text instead of typing it keystroke by
    // keystroke.
    await user.click(textarea)
    await user.paste('{qty} {product_name} for table {table_number}')
    await user.click(screen.getByRole('button', { name: /speak/i }))

    const utterance = window.speechSynthesis.speak.mock.calls[0][0]
    expect(utterance.text).toBe('1 Iced Lemon Tea for table 12')
  })

  it('warns and offers no voice options when no Indonesian voice is installed', () => {
    window.speechSynthesis.getVoices = () => [voices[0]] // Kitchen Voice (en-US) only
    render(<TextToSpeech />)

    expect(screen.getByText(/regardless of which voice is picked/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Voice')).toHaveTextContent('System default')
    expect(screen.queryByRole('option', { name: /kitchen voice/i })).not.toBeInTheDocument()
  })

  it('keeps a previously-chosen non-Indonesian voice visible rather than hiding it silently', () => {
    // Simulates a voice chosen before Indonesian voices were ever available
    // (e.g. stored in localStorage from an earlier session) — the filtered
    // list shouldn't make that stored choice disappear without explanation.
    useTtsStore.getState().setVoiceURI('v1')
    render(<TextToSpeech />)

    expect(screen.getByLabelText('Voice')).toHaveValue('v1')
    expect(screen.getByRole('option', { name: 'Kitchen Voice (en-US)' })).toBeInTheDocument()
    expect(screen.getByText(/spoken with a non-indonesian accent/i)).toBeInTheDocument()
  })

  it('disables Speak for empty text and Stop until something is playing', () => {
    render(<TextToSpeech />)
    expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled()
  })
})
