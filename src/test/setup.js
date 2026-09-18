import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './server'
import { useAuthStore } from '../store/authStore'
import { useTenantStore } from '../store/tenantStore'
import { DEFAULT_THEME, useThemeStore } from '../store/themeStore'
import { DEFAULT_TTS, useTtsStore } from '../store/ttsStore'
import { usePrinterStore } from '../store/printerStore'
import { useErrorLogStore } from '../store/errorLogStore'

// jsdom has no SpeechSynthesis implementation. A passive stub keeps the
// TextToSpeech component's SUPPORTED check true across the suite;
// TextToSpeech.test.jsx swaps in vi.fn() spies where it needs to assert calls.
if (typeof window !== 'undefined' && !window.speechSynthesis) {
  window.speechSynthesis = {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  class FakeUtterance {
    constructor(text) {
      this.text = text
      this.voice = null
    }
  }
  window.SpeechSynthesisUtterance = FakeUtterance
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))

afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  useTenantStore.setState({ companyId: null, companyName: null })
  useThemeStore.setState(DEFAULT_THEME)
  useTtsStore.setState(DEFAULT_TTS)
  usePrinterStore.setState({
    status: 'idle',
    connectionType: null,
    deviceName: null,
    serviceLabel: null,
    error: null,
    device: null,
    characteristic: null,
    autoPrint: false,
    testPrints: [],
    networkHost: '',
    networkPort: '8008',
    networkSecure: false,
    androidTransport: 'bluetooth',
    androidMac: '',
    androidHost: '',
    androidPort: '9100',
  })
  useErrorLogStore.setState({ entries: [] })
})

afterAll(() => server.close())
