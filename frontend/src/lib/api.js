const BASE = '/api'

const FALLBACK_VOICES = [
  { voiceId: 'ru-RU-DmitryNeural',   name: 'Дмитрий',    language: 'ru-RU', gender: 'male'   },
  { voiceId: 'ru-RU-SvetlanaNeural', name: 'Светлана',   language: 'ru-RU', gender: 'female' },
  { voiceId: 'en-US-GuyNeural',      name: 'Guy',         language: 'en-US', gender: 'male'   },
  { voiceId: 'en-US-JennyNeural',    name: 'Jenny',       language: 'en-US', gender: 'female' },
  { voiceId: 'en-GB-RyanNeural',     name: 'Ryan (UK)',   language: 'en-GB', gender: 'male'   },
  { voiceId: 'en-GB-SoniaNeural',    name: 'Sonia (UK)', language: 'en-GB', gender: 'female' },
  { voiceId: 'de-DE-ConradNeural',   name: 'Conrad',      language: 'de-DE', gender: 'male'   },
  { voiceId: 'de-DE-KatjaNeural',    name: 'Katja',       language: 'de-DE', gender: 'female' },
  { voiceId: 'fr-FR-HenriNeural',    name: 'Henri',       language: 'fr-FR', gender: 'male'   },
  { voiceId: 'fr-FR-DeniseNeural',   name: 'Denise',      language: 'fr-FR', gender: 'female' },
]

export async function fetchVoices() {
  try {
    const res = await fetch(`${BASE}/voices`)
    if (!res.ok) return FALLBACK_VOICES
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? data : FALLBACK_VOICES
  } catch {
    return FALLBACK_VOICES
  }
}

export async function generate(text, voiceId, referenceFile = null) {
  const form = new FormData()
  form.append('text', text)
  form.append('voiceId', voiceId)
  if (referenceFile) form.append('reference', referenceFile)

  const res = await fetch(`${BASE}/generate`, { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText)
  return res.json()   // { sessionId, status }
}

export async function fetchHistory() {
  const res = await fetch(`${BASE}/history`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function deleteConversion(id) {
  const res = await fetch(`${BASE}/history/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(res.statusText)
}

export async function deleteAll() {
  const res = await fetch(`${BASE}/history`, { method: 'DELETE' })
  if (!res.ok) throw new Error(res.statusText)
}

export async function startRecording() {
  const res = await fetch(`${BASE}/record/start`, { method: 'POST' })
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function stopRecording() {
  const res = await fetch(`${BASE}/record/stop`, { method: 'POST' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText)
  return res.json()   // { sessionId, inputFile, refPath, status }
}
