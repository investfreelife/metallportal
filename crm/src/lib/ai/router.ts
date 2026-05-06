/**
 * AI Model Router — centralized model selection.
 *
 * Pre-c012b this router tiered tasks by complexity (critical/complex/standard/routine)
 * across paid models (Claude Opus, Sonnet, gpt-4o, gpt-4o-mini). Per
 * `knowledge-base/decisions/2026-05-05_LAW-AI-decoupled-from-core.md`:
 *   - **single free model**, no paid fallback;
 *   - AI is a mini-app — caller must catch graceful fail-fast.
 *
 * `Complexity` enum kept for call-site compatibility. All complexities resolve
 * к the one free model `LLM_MODEL_GENERAL`. Если когда-нибудь снова понадобится
 * tiering (e.g. dev wants Opus reasoning for one task) — set per-call via env
 * override or pass explicit model arg.
 */

import { LLM_MODEL_GENERAL } from '@/lib/llm-models'

export type Complexity = 'critical' | 'complex' | 'standard' | 'routine'

// All tiers collapse к the single free general model.
export const MODEL_MAP: Record<Complexity, string> = {
  critical: LLM_MODEL_GENERAL,
  complex:  LLM_MODEL_GENERAL,
  standard: LLM_MODEL_GENERAL,
  routine:  LLM_MODEL_GENERAL,
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
