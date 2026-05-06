import OpenAI from 'openai'
import type {
  ChatCompletion,
  ChatCompletionCreateParams,
} from 'openai/resources/chat/completions'

/**
 * LLM model selection — single source of truth.
 *
 * Architectural law (knowledge-base/decisions/2026-05-05_LAW-AI-decoupled-from-core.md):
 *   - **Single free model**, no paid fallback. Sergey pays $0 for chat tasks.
 *   - AI is a **mini-app** — core (catalog / SSR / Supabase reads) NEVER depends on AI.
 *     When LLM is down → AI features show graceful "временно недоступно", core unaffected.
 *
 * Defaults derived 2026-05-05 from live OpenRouter `/api/v1/models`. Earlier
 * Llama 3.3 70B / Gemini 2.0 picks either 429 or 404. `openai/gpt-oss-120b:free`
 * — clean Russian, 131K context — picked. Override via env when free roster
 * shifts.
 */

export const LLM_MODEL_GENERAL =
  process.env.LLM_MODEL_GENERAL ?? 'openai/gpt-oss-120b:free'

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'

// Lazy-init: read env at call-time, not module-load. Avoids «missing apiKey»
// throw during Next.js build's page-data collection when env not present
// (e.g. CRM CI workflow without OPENAI_API_KEY secret).
let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_API_BASE
        ? { baseURL: process.env.OPENAI_API_BASE }
        : {}),
    })
  }
  return _openai
}

/**
 * Single-attempt LLM call. Fail-fast — caller MUST catch и serve graceful 503
 * («AI временно недоступно»). No retries here, no paid fallback. Default
 * 10-sec timeout prevents OpenRouter rate-limit cascades blocking downstream
 * requests.
 */
export async function callLLM(
  messages: ChatCompletionCreateParams['messages'],
  opts?: {
    model?: string
    temperature?: number
    maxTokens?: number
    responseFormat?: ChatCompletionCreateParams['response_format']
    timeoutMs?: number
  },
): Promise<ChatCompletion> {
  return getOpenAI().chat.completions.create(
    {
      model: opts?.model ?? LLM_MODEL_GENERAL,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens,
      response_format: opts?.responseFormat,
    },
    {
      timeout: opts?.timeoutMs ?? 10_000,
    },
  )
}
