const BASE = '/api'

export async function fetchVoices() {
  const res = await fetch(`${BASE}/voices`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
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
