/**
 * Build-time check: проверяет что hardcoded ссылки на статические страницы
 * (типа /about, /privacy) реально существуют как routes в app/.
 *
 * Запускается перед `next build` через npm script. Если какая-то ссылка
 * не резолвится — fail и build не идёт.
 *
 * Categories-link'и (всё что под /catalog/...) НЕ проверяются — они
 * идут из БД через lib/categories.ts и могут добавляться/удаляться без
 * code-changes. Их валидирует E2E nav-data-driven.spec.ts на preview
 * (запрос против реального deployment'а: 200 / 308 → 200).
 *
 * См. WINDSURF_TASK_v2_nav_from_db.md.
 */

import { existsSync } from "fs";
import { join } from "path";

// Hardcoded paths которые мы рендерим в Header / Footer / static-pages.
// Эти routes должны существовать в app/, иначе build fails.
const HARDCODED_PATHS = [
  // Top bar / Header
  "/cart",
  "/account",
  "/supplier",
  "/tools",
  "/ai-search",
  "/catalog",
  // Footer (Legal)
  "/privacy",
  "/oferta",
  // Auth — используются на разных страницах
  "/account/login",
  // Admin — отдельный entry-point с AdminGuard
  "/admin",
];

const APP_DIR = join(process.cwd(), "app");
const broken: string[] = [];

for (const path of HARDCODED_PATHS) {
  const segments = path.split("/").filter(Boolean);
  const dir = join(APP_DIR, ...segments);
  // Next.js page может быть либо app/<segs>/page.tsx (UI), либо
  // app/<segs>/route.ts (API). Допустимы оба — нам важно что route
  // вообще резолвится.
  const pageFile = join(dir, "page.tsx");
  const pageFileJs = join(dir, "page.jsx");
  const routeFile = join(dir, "route.ts");
  const routeFileJs = join(dir, "route.js");

  if (
    !existsSync(pageFile) &&
    !existsSync(pageFileJs) &&
    !existsSync(routeFile) &&
    !existsSync(routeFileJs)
  ) {
    broken.push(path);
  }
}

if (broken.length > 0) {
  console.error("❌ verify-nav: broken hardcoded links:");
  broken.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

console.log(
  `✅ verify-nav: ${HARDCODED_PATHS.length} hardcoded links resolve`,
);
