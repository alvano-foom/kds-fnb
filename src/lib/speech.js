// Checked at call time: this module can load before the test setup installs its speechSynthesis stub.
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
 * Speaks `text` with lang 'id-ID' (the only pronunciation lever the Web Speech API offers;
 * a non-Indonesian voice still keeps its own accent). Queues by default; `interrupt: true` cuts in.
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

// customer_reference aliases table_number (Odoo calls client_order_ref "Customer Reference").
const PLACEHOLDERS = {
  qty: (card) => card.qty,
  product_name: (card) => card.product_name,
  table_number: (card) => card.table_number ?? '-',
  customer_reference: (card) => card.table_number ?? '-',
}

export const ANNOUNCEMENT_PLACEHOLDER_NAMES = Object.keys(PLACEHOLDERS)

/** Fills a template like "{qty} {product_name} for table {customer_reference}" with a card's data. */
export function formatAnnouncement(template, card) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const getValue = PLACEHOLDERS[key]
    return getValue ? String(getValue(card)) : match
  })
}
