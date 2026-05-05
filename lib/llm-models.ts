/**
 * LLM model selection — single source of truth for the metallportal app.
 *
 * Lets us swap providers (free OpenRouter ↔ paid OpenAI ↔ Anthropic ↔ ...)
 * без touching call sites — change one constant, deploy, done.
 *
 * Convention:
 *   - LLM_MODEL_GENERAL  — chat tasks (suggest reply, enrichment, SEO).
 *     Default: free Llama 3.3 70B (OpenRouter `:free` tier — top quality, no cost).
 *   - LLM_MODEL_STRUCTURED — JSON / tool-call tasks where strict schema matters.
 *     Default: free Gemini 2.0 Flash (faster on structured output).
 *   - LLM_MODEL_FALLBACK — paid model used when free models are rate-limited / down.
 *     Default: `openai/gpt-4o-mini` через OpenRouter (~$0.15/$0.60 per 1M tokens).
 *   - EMBEDDING_MODEL — paid `text-embedding-3-small` (no free embedding option,
 *     cost is negligible — $0.02 per 1M tokens).
 *
 * All values overridable via env so we can tune без code change.
 *
 * Free-tier rate limits на OpenRouter (as of 2026-05): ~20 RPM / 200 RPD per
 * model. Каждый caller should wrap LLM_MODEL_GENERAL → LLM_MODEL_FALLBACK fallback
 * on 429/503 to stay resilient.
 */

// Default chosen 2026-05-05 from `GET /api/v1/models` live availability:
//   - ТЗ-suggested `meta-llama/llama-3.3-70b-instruct:free` exists but routinely
//     429-rate-limited upstream (Venice provider).
//   - ТЗ-suggested `google/gemini-2.0-flash-exp:free` 404 — endpoint gone.
//   - `openai/gpt-oss-120b:free` (OpenAI's open-source 120B) — clean Russian
//     output, 131K ctx, currently available — picked as primary.
//   - `nvidia/nemotron-3-super-120b-a12b:free` — backup option, also
//     working at time of writing (verbose chain-of-thought style).
// Override at deploy-time через env when picking strategy changes.
export const LLM_MODEL_GENERAL =
  process.env.LLM_MODEL_GENERAL ?? 'openai/gpt-oss-120b:free'

// Same model handles structured outputs (response_format json_object).
// If we ever need a faster small-context structured-only model, swap here
// without touching call sites.
export const LLM_MODEL_STRUCTURED =
  process.env.LLM_MODEL_STRUCTURED ?? 'openai/gpt-oss-120b:free'

// Paid fallback when free models 429/503 — covers all chat endpoints uniformly.
export const LLM_MODEL_FALLBACK =
  process.env.LLM_MODEL_FALLBACK ?? 'openai/gpt-4o-mini'

// Embeddings — paid OpenAI через OpenRouter (no free embedding option,
// cost negligible at $0.02 per 1M tokens).
export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'

/**
 * Standard fallback semantics for `fetch`-style OpenRouter clients.
 * Returns true when the response is rate-limited / temporarily unavailable
 * — caller should retry с LLM_MODEL_FALLBACK на тот же endpoint.
 */
export function shouldFallbackOnError(status: number): boolean {
  return status === 429 || status === 503
}
