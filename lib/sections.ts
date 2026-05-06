/**
 * Catalog sections — split между «металлопрокат» (raw materials)
 * и «готовые изделия» (constructions: навесы, заборы, гаражи, etc.).
 *
 * Source of truth — column `categories.display_section` (Иван #026 migration).
 * Root-level categories помечены текстовым value в этом column.
 *
 * ⚠️ **`SECTION_METALLPROKAT` содержит cyrillic 'о' (U+043E)** — typo от
 * Иван #026 в БД, byte_len=14 vs char_len=13. Latin 'o' НЕ matches existing
 * data. Чтобы избежать ошибок string literal'ами в queries — используем
 * эту константу везде. Когда Иван fix'ит migration — обновится здесь
 * одной строкой, no scattered changes.
 */

export const SECTION_METALLPROKAT = "metallоprokat"; // ВНИМАНИЕ: cyrillic 'о'
export const SECTION_CONSTRUCTIONS = "constructions";

export type CatalogSection =
  | typeof SECTION_METALLPROKAT
  | typeof SECTION_CONSTRUCTIONS;

/**
 * UI metadata per section — используется в sidebar header + page heading +
 * meta-data. Chnage here → applies в catalog + constructions pages.
 */
export const SECTION_META: Record<
  CatalogSection,
  { label: string; href: string; icon: string; pageHeading: string; pageDescription: string }
> = {
  [SECTION_METALLPROKAT]: {
    label: "Каталог",
    href: "/catalog",
    icon: "📦",
    pageHeading: "Каталог металлопроката",
    pageDescription:
      "Полный ассортимент металлопроката, труб, нержавеющей стали, цветных металлов и инженерных систем. Оптом и в розницу с доставкой по России.",
  },
  [SECTION_CONSTRUCTIONS]: {
    label: "Готовые изделия",
    href: "/constructions",
    icon: "🏗",
    pageHeading: "Готовые изделия из металла",
    pageDescription:
      "Производство и монтаж под ключ: навесы, заборы, гаражи, здания из сэндвич-панелей, металлоконструкции и художественные изделия.",
  },
};
