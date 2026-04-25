/**
 * AI Model Router — centralized model selection by task complexity
 *
 * critical  → anthropic/claude-opus-4-6   (CEO decisions, strategic reasoning)
 * complex   → anthropic/claude-sonnet-4-6 (analysis, evaluation, reports)
 * standard  → openai/gpt-4o               (emails, proposals, replies)
 * routine   → openai/gpt-4o-mini          (classification, scoring, quick tasks)
 */

export type Complexity = 'critical' | 'complex' | 'standard' | 'routine'

export const MODEL_MAP: Record<Complexity, string> = {
  critical: 'anthropic/claude-opus-4-6',
  complex:  'anthropic/claude-sonnet-4-6',
  standard: 'openai/gpt-4o',
  routine:  'openai/gpt-4o-mini',
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REFERER = 'https://metallportal-crm2.vercel.app'

export interface RouterOptions {
  complexity: Complexity
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
}

export async function routeAI(opts: RouterOptions): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')

  const model = MODEL_MAP[opts.complexity]

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': REFERER,
      'X-Title': 'MetallPortal CRM AI',
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.4,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter [${model}] ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}
