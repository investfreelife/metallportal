import OpenAI from 'openai'
import type {
  ChatCompletion,
  ChatCompletionCreateParams,
} from 'openai/resources/chat/completions'

/**
 * LLM model selection — CRM mirror of `metallportal/lib/llm-models.ts`.
 *
 * Architectural law (knowledge-base/decisions/2026-05-05_LAW-AI-decoupled-from-core.md):
 *   - **Single free model**, no paid fallback. Sergey pays $0 for chat tasks.
 *   - AI is a mini-app — core never depends on AI being available.
 *
 * Mirrored из main app (separate tsconfig paths between crm/ и metallportal/).
 * When this changes, mirror the other.
 */

export const LLM_MODEL_GENERAL =
  process.env.LLM_MODEL_GENERAL ?? 'openai/gpt-oss-120b:free'

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(process.env.OPENAI_API_BASE
    ? { baseURL: process.env.OPENAI_API_BASE }
    : {}),
})

/**
 * Single-attempt LLM call. Fail-fast — caller MUST catch и serve graceful 503.
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
  return openai.chat.completions.create(
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
