import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Frontend-only voice settings. `text` is the announcement template; empty `voiceURI` = browser default voice. */
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
