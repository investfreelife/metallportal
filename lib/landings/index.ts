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
import { garazhSendvich } from "./garazh-iz-sendvich-paneley";
import { zdaniyaSendvich } from "./zdaniya-iz-sendvich-paneley";
import { konstruktsiiIzMetalla } from "./konstruktsii-iz-metalla";
import { protivopodkopnyyeSetki } from "./protivopodkopnye-setki";
import { izdeliyaIzMetalla } from "./izdeliya-iz-metalla";

export const LANDINGS: Record<string, LandingConfig> = {
  // M003 sample (m003 #72)
  "zabory-svarnye": zaboryVarnyye,
  // N003 batch (5 landings — battle mode 7-day launch)
  "garazh-iz-sendvich-paneley": garazhSendvich,
  "zdaniya-iz-sendvich-paneley": zdaniyaSendvich,
  "konstruktsii-iz-metalla": konstruktsiiIzMetalla,
  "protivopodkopnye-setki": protivopodkopnyyeSetki,
  "izdeliya-iz-metalla": izdeliyaIzMetalla,
};

export function getLanding(slug: string): LandingConfig | null {
  return LANDINGS[slug] ?? null;
}

export type { LandingConfig } from "./types";
