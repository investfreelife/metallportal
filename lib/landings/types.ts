/**
 * Типы для config-driven landing engine (`/landing/[slug]`).
 *
 * Архитектура: каждая landing описывается одним объектом `LandingConfig`
 * (registered в `lib/landings/index.ts`). Page route `app/landing/[slug]`
 * lookup'ит config по slug и рендерит набор reusable секций. Контент
 * пишут координаторы (Антон) в research/landings/{slug}.md → переносим
 * в `lib/landings/{slug}.ts`.
 *
 * Migration path к БД (Phase 2): создаётся `landings(slug, content jsonb)`,
 * `getLanding()` начинает читать из таблицы. Типы остаются те же → код
 * секций не меняется.
 */

export type CalculatorFieldType = "number" | "select";
export type CalculatorType =
  | "sandwich"
  | "fence"
  | "metal-construction"
  | "mesh"
  | "custom";

export type LeadFormField =
  | "name"
  | "phone"
  | "email"
  | "message"
  | "attachment";

export type LandingSchemaType = "Service" | "Product";

export interface LandingConfig {
  /** URL-slug, e.g. "zabory-svarnye". Match'ит segment в `/landing/[slug]`. */
  slug: string;

  /** SEO meta — Title/Description/Keywords + (optional) override OG title. */
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle?: string;
  };

  /** Hero block (главный экран). */
  hero: {
    h1: string;
    subtitle: string;
    /** Текст primary CTA-кнопки (обычно "Заказать расчёт за 5 минут"). */
    ctaPrimary: string;
    /** Path в public/ или absolute URL. Stub if нет реального. */
    heroImageSrc: string;
    /** Optional secondary CTA — обычно "Смотреть кейсы" (anchor #cases). */
    ctaSecondary?: string;
    /** Optional trust-strip под кнопками — bullet list (галочки). */
    trustStrip?: string[];
  };

  /** Преимущества — 3-5 cards. */
  benefits: Array<{
    /** Emoji или Lucide-icon name (рендер как текст). */
    icon?: string;
    title: string;
    description: string;
  }>;

  /** Калькулятор расчёта (опционален). */
  calculator: {
    enabled: boolean;
    type: CalculatorType;
    fields: Array<{
      name: string;
      label: string;
      unit?: string;
      type: CalculatorFieldType;
      options?: string[];
      defaultValue?: number | string;
      min?: number;
      max?: number;
    }>;
    /** Human-readable формула (для админ-визибилити). */
    formula: string;
    /** Подпись под результатом, e.g. "цена ориентировочная, точная — после связи". */
    resultNote?: string;
  };

  /** Этапы работы — 4-6 step cards. */
  process: Array<{
    step: number;
    title: string;
    description: string;
  }>;

  /** Кейсы выполненных работ. */
  cases: Array<{
    title: string;
    image: string;
    dimensions?: string;
    price?: string;
    duration?: string;
    quote?: string;
  }>;

  /** FAQ block (рендер как `<details>` accordion для no-JS). */
  faq: Array<{
    question: string;
    answer: string;
  }>;

  /** Bottom-of-page CTA + lead form. */
  cta: {
    title: string;
    subtitle?: string;
    formFields: LeadFormField[];
  };

  /** Schema.org root type — `Service` (услуга-под-заказ) или `Product`. */
  schemaType: LandingSchemaType;

  /** Все landings уважают ref_code cookie (m001 ref-tracker). */
  referralCookieAware: true;

  // ========== #028 Power Upgrade — optional sections ==========

  /** Pain → Solution narrative block. Рендер LandingPainSolution. */
  painSolution?: {
    painTitle: string;
    painPoints: string[];
    solutionTitle: string;
    solutionPoints: string[];
  };

  /** Customer testimonials (5 рекомендуется). Рендер LandingTestimonials. */
  testimonials?: Array<{
    author: string;
    company?: string;
    rating: 1 | 2 | 3 | 4 | 5;
    quote: string;
    source?: "yandex_maps" | "2gis" | "avito" | "direct";
    date?: string;
  }>;

  /** Trust badges — legal/guarantee/standards/objects. Рендер LandingTrust. */
  trustBadges?: {
    legal?: { inn?: string; ogrn?: string; sroLicense?: string };
    guarantee?: { years: number; description: string };
    standards?: string[];
    objectsCompleted?: number;
    /** Aggregate rating передаётся в LandingTestimonials через page wiring. */
    aggregateRating?: { score: number; reviewsCount: number };
  };

  /** Lead magnet (PDF / гайд). Рендер LandingLeadMagnet. */
  leadMagnet?: {
    title: string;
    description: string;
    fileSrc: string;
    formCta: string;
  };

  /** Mid-page CTAs — placement определяет порядок render в page. */
  additionalCTAs?: Array<{
    placement: "after_benefits" | "after_calculator" | "after_cases" | "after_faq";
    title: string;
    subtitle?: string;
    ctaText: string;
    variant?: "compact" | "wide";
  }>;
}
