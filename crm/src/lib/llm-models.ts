/**
 * LLM model selection — CRM mirror of `metallportal/lib/llm-models.ts`.
 *
 * CRM is a separate Next.js app (own tsconfig paths), so we duplicate the
 * constants here rather than reaching across project boundaries. Keep both
 * files в sync — when one changes, mirror the other (small surface, low risk).
 *
 * See `metallportal/lib/llm-models.ts` for full doc + rationale.
 */

export const LLM_MODEL_GENERAL =
  process.env.LLM_MODEL_GENERAL ?? 'openai/gpt-oss-120b:free'

export const LLM_MODEL_STRUCTURED =
  process.env.LLM_MODEL_STRUCTURED ?? 'openai/gpt-oss-120b:free'

export const LLM_MODEL_FALLBACK =
  process.env.LLM_MODEL_FALLBACK ?? 'openai/gpt-4o-mini'

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'

export function shouldFallbackOnError(status: number): boolean {
  return status === 429 || status === 503
}
