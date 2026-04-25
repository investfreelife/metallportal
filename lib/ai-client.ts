const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'https://ai.harlansteel.ru'
const AI_KEY = process.env.AI_API_KEY || ''

export async function searchMetal(query: string, context?: object) {
  const res = await fetch(`${AI_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
    body: JSON.stringify({ query, context }),
  })
  if (!res.ok) throw new Error('AI search failed')
  return res.json()
}

export async function voiceSearch(audioBlob: Blob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.ogg')
  const res = await fetch(`${AI_BASE}/api/search/voice`, {
    method: 'POST',
    headers: { 'X-API-Key': AI_KEY },
    body: form,
  })
  if (!res.ok) throw new Error('Voice search failed')
  return res.json()
}

export async function parseDocument(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${AI_BASE}/api/documents/parse`, {
    method: 'POST',
    headers: { 'X-API-Key': AI_KEY },
    body: form,
  })
  if (!res.ok) throw new Error('Document parse failed')
  return res.json()
}

export async function processLead(leadData: {
  full_name?: string
  company_name?: string
  phone?: string
  email?: string
  message?: string
  source?: string
  contact_id?: string
}) {
  const res = await fetch(`${AI_BASE}/api/agents/sales/process-lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': AI_KEY },
    body: JSON.stringify(leadData),
  })
  if (!res.ok) throw new Error('Lead processing failed')
  return res.json()
}
