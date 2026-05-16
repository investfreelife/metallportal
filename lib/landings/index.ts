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
// ТЗ #048 (Sergey 2026-05-15) — izdeliya-iz-metalla split на 5 focused landings.
// Старый landing удалён, 301 redirect /landing/izdeliya-iz-metalla → /constructions
// прописан в next.config redirects().
import { lestnicyMetallicheskie } from "./lestnicy-metallicheskie";
import { kozyrki } from "./kozyrki";
import { antresoli } from "./antresoli";
import { konteynernyePloschadki } from "./konteynernye-ploschadki";
import { mafBlagoustroystva } from "./maf-blagoustroystva";

export const LANDINGS: Record<string, LandingConfig> = {
  // M003 sample (m003 #72)
  "zabory-svarnye": zaboryVarnyye,
  // N003 batch (4 — после #048 без izdeliya-iz-metalla)
  "garazh-iz-sendvich-paneley": garazhSendvich,
  "zdaniya-iz-sendvich-paneley": zdaniyaSendvich,
  "konstruktsii-iz-metalla": konstruktsiiIzMetalla,
  "protivopodkopnye-setki": protivopodkopnyyeSetki,
  // ТЗ #048 (Sergey 2026-05-15) — 5 new focused landings
  "lestnicy-metallicheskie": lestnicyMetallicheskie,
  "kozyrki": kozyrki,
  "antresoli": antresoli,
  "konteynernye-ploschadki": konteynernyePloschadki,
  "maf-blagoustroystva": mafBlagoustroystva,
};

export function getLanding(slug: string): LandingConfig | null {
  return LANDINGS[slug] ?? null;
}

export type { LandingConfig } from "./types";
