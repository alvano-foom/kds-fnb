import { useEffect, useMemo, useRef, useState } from 'react'
import { useTtsStore } from '../../store/ttsStore'
import { Button } from '../atoms/Button'
import {
  formatAnnouncement,
  getVoices,
  isIndonesianVoice,
  isSpeechSupported,
  pickIndonesianVoiceURI,
  speakText,
  stopSpeaking,
} from '../../lib/speech'

// Sample card used only to preview the template below — real announcements
// substitute the actual order's data (see PendingOrderAlerts.jsx).
const PREVIEW_CARD = { qty: 1, product_name: 'Iced Lemon Tea', table_number: '12' }

/**
 * Configures the announcement TEMPLATE and voice used for every new-order
 * announcement (see PendingOrderAlerts.jsx) — built on the browser's native
 * SpeechSynthesis API, no library needed. Text and the chosen voice are
 * frontend-only settings persisted to localStorage (see store/ttsStore.js),
 * the same pattern as the theme colors. Defaults to Indonesian
 * pronunciation (see src/lib/speech.js) and auto-picks an Indonesian voice
 * the first time the browser's voice list loads, if one is available and
 * the person hasn't already chosen a voice of their own.
 */
export function TextToSpeech() {
  const { text, voiceURI, setText, setVoiceURI } = useTtsStore()
  const [voices, setVoices] = useState(() => getVoices())
  const [speaking, setSpeaking] = useState(false)
  const autoPickedRef = useRef(false)

  useEffect(() => {
    if (!isSpeechSupported()) return undefined
    // Chrome loads voices asynchronously — the list is often empty on the
    // very first call, so refresh it once the browser reports it's ready.
    const loadVoices = () => setVoices(getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    loadVoices()
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(() => {
    if (autoPickedRef.current || voices.length === 0 || voiceURI) return
    const idVoice = pickIndonesianVoiceURI(voices)
    if (idVoice) setVoiceURI(idVoice)
    autoPickedRef.current = true
  }, [voices, voiceURI, setVoiceURI])

  const indonesianVoices = useMemo(() => voices.filter(isIndonesianVoice), [voices])
  const selectedVoice = voices.find((v) => v.voiceURI === voiceURI)
  const hasIndonesianVoice = indonesianVoices.length > 0
  const accentMismatch = isSpeechSupported() && (selectedVoice ? !isIndonesianVoice(selectedVoice) : !hasIndonesianVoice)

  // Only Indonesian voices are worth showing — anything else can't sound
  // Indonesian regardless of this setting (see the note below the select).
  // The one exception: if a non-Indonesian voice is already selected (e.g.
  // a leftover choice from before Indonesian voices were installed), it
  // stays listed too, so switching to this filtered list never silently
  // hides the person's current selection out from under them.
  const listedVoices =
    selectedVoice && !isIndonesianVoice(selectedVoice) ? [selectedVoice, ...indonesianVoices] : indonesianVoices

  const preview = formatAnnouncement(text, PREVIEW_CARD)

  if (!isSpeechSupported()) {
    return <p className="text-sm text-gray-500">Text-to-speech isn't supported in this browser.</p>
  }

  function speak() {
    // Speak the filled-in preview, not the raw template — otherwise a
    // "{qty} {product_name}..." template would be read out literally,
    // placeholders and all.
    const utterance = speakText(preview, { voiceURI, interrupt: true })
    if (!utterance) return
    setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
  }

  function stop() {
    stopSpeaking()
    setSpeaking(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="tts-text">
          Announcement text
        </label>
        <textarea
          id="tts-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <p className="mt-1.5 text-xs text-gray-400">
          This is the template used for every new-order announcement, both the toast and the spoken
          message. Use {'{qty}'}, {'{product_name}'}, and {'{customer_reference}'} (or {'{table_number}'})
          as placeholders — they're filled in with each order's real values.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Preview with a sample order: <span className="italic">"{preview}"</span>
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="tts-voice">
          Voice
        </label>
        <select
          id="tts-voice"
          value={voiceURI}
          onChange={(e) => setVoiceURI(e.target.value)}
          className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">System default</option>
          {listedVoices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {isIndonesianVoice(v) ? '🇮🇩 ' : ''}
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-gray-400">
          Only Indonesian voices are listed here — any other voice would still speak with its own
          accent no matter what, since the app can only request Indonesian pronunciation, not force a
          non-Indonesian voice to sound Indonesian. If none are listed, no Indonesian voice is
          installed on this device/browser yet.
        </p>
        {accentMismatch && (
          <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            {hasIndonesianVoice
              ? 'The selected voice isn\'t Indonesian, so announcements will be spoken with a non-Indonesian accent.'
              : 'No Indonesian voice is installed on this device/browser, so announcements will be spoken with a non-Indonesian accent regardless of which voice is picked.'}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={speak} disabled={!text.trim()}>
          {speaking ? 'Speaking…' : 'Speak'}
        </Button>
        <Button type="button" variant="secondary" onClick={stop} disabled={!speaking}>
          Stop
        </Button>
      </div>
    </div>
  )
}
