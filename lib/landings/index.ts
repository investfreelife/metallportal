/**
 * Registry всех landing-pages.
 *
 * Добавление новой landing:
 *  1. Создать файл `lib/landings/{slug}.ts` с export'ом `LandingConfig`.
 *  2. Импортировать сюда + добавить в `LANDINGS`.
 *  3. После redeploy — `/landing/{slug}` живёт + автоматически попадает в
 *     sitemap (`app/sitemap.ts` → `LANDINGS` map).
 *
 * `dynamicParams = false` в page.tsx → unknown slug → 404 (без try-fetch DB).
 * Это **white-list** approach — безопаснее, проще для CDN.
 */

import type { LandingConfig } from "./types";
import { zaboryVarnyye } from "./zabory-svarnye";

export const LANDINGS: Record<string, LandingConfig> = {
  "zabory-svarnye": zaboryVarnyye,
  // m004 batch добавит:
  //   "garazh-iz-sendvich-paneley"
  //   "zdaniya-iz-sendvich-paneley"
  //   "konstruktsii-iz-metalla"
  //   "protivopodkopnye-setki"
  //   "izdeliya-iz-metalla"
};

export function getLanding(slug: string): LandingConfig | null {
  return LANDINGS[slug] ?? null;
}

export type { LandingConfig } from "./types";
