import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Text-to-speech settings — like theme color (src/store/themeStore.js),
 * this is a frontend-only preference persisted to this browser's
 * localStorage, not part of the API. `voiceURI` identifies a voice from
 * the browser's own SpeechSynthesis voice list (see TextToSpeech.jsx);
 * it's empty by default, meaning "let the browser pick its default voice."
 *
 * `text` is the announcement TEMPLATE used both for the manual "Speak"
 * preview and for every real new-order announcement (see
 * PendingOrderAlerts.jsx) — it's filled in per order with
 * src/lib/speech.js's formatAnnouncement(), so the same configured wording
 * drives both, with no hardcoded message anywhere in the app.
 */
export const DEFAULT_TTS = {
  text: '{qty} {product_name} for table {customer_reference}',
  voiceURI: '',
}

export const useTtsStore = create(
  persist(
    (set) => ({
      ...DEFAULT_TTS,
      setText: (text) => set({ text }),
      setVoiceURI: (voiceURI) => set({ voiceURI }),
    }),
    { name: 'kds_tts' },
  ),
)
