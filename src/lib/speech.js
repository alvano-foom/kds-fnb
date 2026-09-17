// Thin wrapper around the browser's native SpeechSynthesis API — shared by
// the manual "Speak" button (TextToSpeech.jsx) and the automatic new-order
// announcements (PendingOrderAlerts.jsx) so both use the same voice
// preference and the same Indonesian-pronunciation default.

// Checked at call time rather than cached as a load-time constant: speech.js
// can end up imported before test setup has finished installing its
// window.speechSynthesis stub, and a load-time constant would freeze in the
// wrong answer.
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getVoices() {
  return isSpeechSupported() ? window.speechSynthesis.getVoices() : []
}

/** True if this voice's own language is Indonesian. */
export function isIndonesianVoice(voice) {
  return Boolean(voice?.lang?.toLowerCase().startsWith('id'))
}

/** First voice whose language looks Indonesian, if the browser has one. */
export function pickIndonesianVoiceURI(voices) {
  return voices.find(isIndonesianVoice)?.voiceURI ?? ''
}

/**
 * Speaks `text`, requesting Indonesian pronunciation by default
 * (`lang: 'id-ID'`). This is always set on the utterance — including when
 * a specific voice is picked — because it's the only lever the Web Speech
 * API gives a page for pronunciation; whether it actually produces an
 * Indonesian *accent* depends on the voice itself: a voice whose own
 * language isn't Indonesian (e.g. "Microsoft David - English (US)") will
 * still speak with its own accent regardless of this setting — that's a
 * limitation of what voice the browser/OS has installed, not something a
 * page can override. See isIndonesianVoice() / pickIndonesianVoiceURI()
 * for helping the person choose a voice that actually supports it.
 *
 * By default this queues behind anything already speaking (the browser
 * plays queued utterances in order); pass `interrupt: true` to cut in
 * immediately, which the manual "Speak" test button does.
 */
export function speakText(text, { voiceURI = '', lang = 'id-ID', interrupt = false } = {}) {
  if (!isSpeechSupported() || !text?.trim()) return null
  if (interrupt) window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  const voice = getVoices().find((v) => v.voiceURI === voiceURI)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
  return utterance // caller can attach onstart/onend/onerror if it cares
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

// Card fields an announcement template can reference. `customer_reference`
// is an alias for table_number — it's what this same field is called on
// the Odoo sale.order record (client_order_ref, labeled "Customer
// Reference"), so either name reads naturally in a template.
const PLACEHOLDERS = {
  qty: (card) => card.qty,
  product_name: (card) => card.product_name,
  table_number: (card) => card.table_number ?? '-',
  customer_reference: (card) => card.table_number ?? '-',
}

export const ANNOUNCEMENT_PLACEHOLDER_NAMES = Object.keys(PLACEHOLDERS)

/**
 * Fills a configurable template (e.g. "{qty} {product_name} for table
 * {customer_reference}", the default in store/ttsStore.js) in with a
 * card's real data. A template with no placeholders is returned unchanged,
 * so a plain static message works too.
 */
export function formatAnnouncement(template, card) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const getValue = PLACEHOLDERS[key]
    return getValue ? String(getValue(card)) : match
  })
}
