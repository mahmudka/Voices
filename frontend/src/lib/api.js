const BASE = '/api'

const FALLBACK_VOICES = [
  // Russian
  { voiceId: 'ru-RU-DmitryNeural',               name: 'Дмитрий',   language: 'ru-RU', gender: 'male'   },
  { voiceId: 'ru-RU-SvetlanaNeural',             name: 'Светлана',  language: 'ru-RU', gender: 'female' },
  // English US
  { voiceId: 'en-US-AvaNeural',                  name: 'Ava',       language: 'en-US', gender: 'female' },
  { voiceId: 'en-US-AndrewNeural',               name: 'Andrew',    language: 'en-US', gender: 'male'   },
  { voiceId: 'en-US-EmmaNeural',                 name: 'Emma',      language: 'en-US', gender: 'female' },
  { voiceId: 'en-US-BrianNeural',                name: 'Brian',     language: 'en-US', gender: 'male'   },
  { voiceId: 'en-US-GuyNeural',                  name: 'Guy',       language: 'en-US', gender: 'male'   },
  { voiceId: 'en-US-JennyNeural',                name: 'Jenny',     language: 'en-US', gender: 'female' },
  // English UK
  { voiceId: 'en-GB-RyanNeural',                 name: 'Ryan',      language: 'en-GB', gender: 'male'   },
  { voiceId: 'en-GB-SoniaNeural',                name: 'Sonia',     language: 'en-GB', gender: 'female' },
  { voiceId: 'en-GB-LibbyNeural',                name: 'Libby',     language: 'en-GB', gender: 'female' },
  { voiceId: 'en-GB-ThomasNeural',               name: 'Thomas',    language: 'en-GB', gender: 'male'   },
  { voiceId: 'en-GB-MaisieNeural',               name: 'Maisie',    language: 'en-GB', gender: 'female' },
  // German
  { voiceId: 'de-DE-SeraphinaMultilingualNeural', name: 'Seraphina', language: 'de-DE', gender: 'female' },
  { voiceId: 'de-DE-FlorianMultilingualNeural',  name: 'Florian',   language: 'de-DE', gender: 'male'   },
  { voiceId: 'de-DE-AmalaNeural',                name: 'Amala',     language: 'de-DE', gender: 'female' },
  { voiceId: 'de-DE-ConradNeural',               name: 'Conrad',    language: 'de-DE', gender: 'male'   },
  { voiceId: 'de-DE-KatjaNeural',                name: 'Katja',     language: 'de-DE', gender: 'female' },
  { voiceId: 'de-DE-KillianNeural',              name: 'Killian',   language: 'de-DE', gender: 'male'   },
  // French
  { voiceId: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne',  language: 'fr-FR', gender: 'female' },
  { voiceId: 'fr-FR-RemyMultilingualNeural',     name: 'Rémy',      language: 'fr-FR', gender: 'male'   },
  { voiceId: 'fr-FR-DeniseNeural',               name: 'Denise',    language: 'fr-FR', gender: 'female' },
  { voiceId: 'fr-FR-EloiseNeural',               name: 'Éloïse',    language: 'fr-FR', gender: 'female' },
  { voiceId: 'fr-FR-HenriNeural',                name: 'Henri',     language: 'fr-FR', gender: 'male'   },
  // Spanish
  { voiceId: 'es-ES-XimenaNeural',               name: 'Ximena',    language: 'es-ES', gender: 'female' },
  { voiceId: 'es-ES-AlvaroNeural',               name: 'Álvaro',    language: 'es-ES', gender: 'male'   },
  { voiceId: 'es-ES-ElviraNeural',               name: 'Elvira',    language: 'es-ES', gender: 'female' },
  // Romanian
  { voiceId: 'ro-RO-AlinaNeural',                name: 'Alina',     language: 'ro-RO', gender: 'female' },
  { voiceId: 'ro-RO-EmilNeural',                 name: 'Emil',      language: 'ro-RO', gender: 'male'   },
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
  return res.json()
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
  return res.json()
}
