const BASE = '/api'

export async function fetchVoices() {
  const res = await fetch(`${BASE}/voices`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function uploadAndConvert(file, params) {
  const form = new FormData()
  form.append('file', file)
  if (params.voiceId) form.append('voiceId', params.voiceId)
  form.append('voiceType', params.voiceType)
  form.append('age', String(params.age))
  form.append('timbre', params.timbre)

  const res = await fetch(`${BASE}/convert`, { method: 'POST', body: form })
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
  return res.json()
}

export async function rerender(sessionId, params) {
  const res = await fetch(`${BASE}/convert/rerender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, ...params }),
  })
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
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

export async function deleteSession(sessionId) {
  const res = await fetch(`${BASE}/history/session/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(res.statusText)
}

export async function deleteAll() {
  const res = await fetch(`${BASE}/history`, { method: 'DELETE' })
  if (!res.ok) throw new Error(res.statusText)
}

export async function fetchDevices() {
  const res = await fetch(`${BASE}/devices`)
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

export async function startRecording() {
  const res = await fetch(`${BASE}/record/start`, { method: 'POST' })
  if (!res.ok) throw new Error(res.statusText)
  return res.json() // { sessionId, inputFile }
}

export async function stopRecording({ voiceType, age, timbre }) {
  const res = await fetch(`${BASE}/record/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceType, age, timbre }),
  })
  if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
  return res.json() // { sessionId, inputFile, status }
}

export function audioUrl(path) {
  return `${BASE}/audio?path=${encodeURIComponent(path)}`
}
