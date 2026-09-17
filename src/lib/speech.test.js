import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatAnnouncement, isIndonesianVoice, pickIndonesianVoiceURI, speakText } from './speech'

describe('speakText', () => {
  beforeEach(() => {
    window.speechSynthesis.speak = vi.fn()
    window.speechSynthesis.cancel = vi.fn()
    window.speechSynthesis.getVoices = () => []
  })

  it('defaults the utterance to Indonesian when no voice is selected', () => {
    const utterance = speakText('Pesanan siap untuk meja 5.')
    expect(utterance.lang).toBe('id-ID')
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(utterance)
  })

  it('always forces the requested lang, even when a voice with a different language is matched', () => {
    // The Web Speech API's only pronunciation lever is utterance.lang — a
    // matched voice is still used for its *voice*, but lang stays what was
    // requested (id-ID by default) so pronunciation intent isn't silently
    // overridden by whichever voice happens to be selected.
    window.speechSynthesis.getVoices = () => [{ voiceURI: 'v1', name: 'UK English', lang: 'en-GB' }]
    const utterance = speakText('Hello', { voiceURI: 'v1' })
    expect(utterance.voice.voiceURI).toBe('v1')
    expect(utterance.lang).toBe('id-ID')
  })

  it('does nothing for blank text', () => {
    expect(speakText('   ')).toBeNull()
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
  })

  it('cancels first only when interrupt is set', () => {
    speakText('hi', { interrupt: true })
    expect(window.speechSynthesis.cancel).toHaveBeenCalledOnce()
  })
})

describe('pickIndonesianVoiceURI', () => {
  it('finds the first voice whose language starts with id', () => {
    const voices = [
      { voiceURI: 'v1', lang: 'en-US' },
      { voiceURI: 'v2', lang: 'id-ID' },
    ]
    expect(pickIndonesianVoiceURI(voices)).toBe('v2')
  })

  it('returns an empty string when none match', () => {
    expect(pickIndonesianVoiceURI([{ voiceURI: 'v1', lang: 'en-US' }])).toBe('')
  })
})

describe('isIndonesianVoice', () => {
  it('is true for a voice whose lang starts with id', () => {
    expect(isIndonesianVoice({ lang: 'id-ID' })).toBe(true)
  })

  it('is false for a non-Indonesian voice or a missing voice', () => {
    expect(isIndonesianVoice({ lang: 'en-US' })).toBe(false)
    expect(isIndonesianVoice(undefined)).toBe(false)
  })
})

describe('formatAnnouncement', () => {
  const card = { qty: 1, product_name: 'Iced Lemon Tea', table_number: '12' }

  it('fills in qty, product_name, and table placeholders', () => {
    expect(formatAnnouncement('{qty} {product_name} untuk meja {customer_reference}', card)).toBe(
      '1 Iced Lemon Tea untuk meja 12',
    )
    expect(formatAnnouncement('{qty} {product_name} for table {table_number}', card)).toBe(
      '1 Iced Lemon Tea for table 12',
    )
  })

  it('leaves unknown placeholders untouched and passes through plain text', () => {
    expect(formatAnnouncement('{unknown} thing', card)).toBe('{unknown} thing')
    expect(formatAnnouncement('Order ready.', card)).toBe('Order ready.')
  })

  it('falls back to "-" when a card has no table number', () => {
    expect(formatAnnouncement('meja {customer_reference}', { ...card, table_number: undefined })).toBe(
      'meja -',
    )
  })
})
