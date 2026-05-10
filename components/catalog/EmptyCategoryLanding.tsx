import Link from "next/link";
import { Phone, Send, ShieldCheck, Truck, Award, FileText, ArrowRight } from "lucide-react";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from "@/lib/contact";

/**
 * EmptyCategoryLanding — SEO-optimized fallback страница для категорий с 0 products.
 *
 * Per Sergey 2026-05-09: «если нету товаров в данной категории то показывается
 * landing с SEO продвижением... как только мы его запишем товары значит показывают товары».
 *
 * Используется в:
 *  - app/catalog/[category]/page.tsx (L1 без products)
 *  - app/catalog/[category]/[subcategory]/page.tsx (L2 без products)
 *  - app/catalog/[category]/[subcategory]/[slug]/page.tsx (L3 без products)
 *
 * Когда categoryId tree получает products → CatalogView renders normally
 * (этот компонент не вызывается).
 *
 * Schema.org Service markup для SEO + organic ранжирование.
 */

interface EmptyCategoryLandingProps {
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    seo_text?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
  };
  /** Breadcrumb chain без рендеринга самого breadcrumb (page-level рендерит). */
  parentName?: string;
}

export default function EmptyCategoryLanding({ category, parentName }: EmptyCategoryLandingProps) {
  const title = category.seo_title || category.name;
  const intro =
    category.description ||
    `${category.name} — производство, поставка и доставка по Москве и России. Работаем с юр. и физ. лицами по полному пакету документов с НДС.`;
  const seoBlocks = (category.seo_text || "").split(/\n{2,}/).filter(Boolean);

  // Schema.org Service markup
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: title,
    description: category.seo_description || intro.slice(0, 160),
    provider: {
      "@type": "Organization",
      name: "Харланметалл",
      telephone: CONTACT_PHONE_DISPLAY,
      url: `https://www.harlansteel.ru/catalog/${category.slug}`,
    },
    areaServed: { "@type": "Country", name: "Россия" },
  };

  return (
    <article className="space-y-12">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Hero */}
      <section className="space-y-4">
        <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight">{title}</h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">{intro}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="#contact-form"
            className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-7 py-3.5 rounded-lg transition-all text-base"
          >
            Получить КП за 5 минут
            <ArrowRight size={18} />
          </a>
          <a
            href={`tel:${CONTACT_PHONE_TEL}`}
            className="inline-flex items-center gap-2 border-2 border-gold text-foreground hover:bg-gold/10 font-semibold px-6 py-3.5 rounded-lg transition-all text-base"
          >
            <Phone size={18} className="text-gold" />
            {CONTACT_PHONE_DISPLAY}
          </a>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Наполнение каталога этого раздела в работе. Все позиции доступны под заказ — точная цена
          и сроки после связи с менеджером.
        </p>
      </section>

      {/* SEO content blocks */}
      {seoBlocks.length > 0 && (
        <section className="prose prose-invert max-w-3xl space-y-4">
          {seoBlocks.map((block, i) => (
            <p key={i} className="text-foreground/80 leading-relaxed">
              {block}
            </p>
          ))}
        </section>
      )}

      {/* Why us — 4 trust cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Award,
            title: "Опыт 12+ лет",
            desc: "Поставки металлопроката с 2012 года. 500+ корпоративных клиентов и госзаказчиков.",
          },
          {
            icon: ShieldCheck,
            title: "Гарантия качества",
            desc: "Сертификаты ISO 9001 и НАКС. Документы по ГОСТ на каждую партию.",
          },
          {
            icon: Truck,
            title: "Доставка по РФ",
            desc: "Собственный транспорт до объекта. Москва — день в день, регионы — 1-7 дней.",
          },
          {
            icon: FileText,
            title: "Договор + НДС",
            desc: "Работа с юр. и физ. лицами. Все формы оплаты, отсрочка для постоянных клиентов.",
          },
        ].map(({ icon: Icon, title: t, desc }, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <Icon size={28} className="text-gold" />
            <h3 className="text-base font-bold text-foreground">{t}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* Lead form */}
      <section
        id="contact-form"
        className="bg-card border border-border rounded-lg p-6 max-w-2xl space-y-5"
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground">
            Заказать {category.name.toLowerCase()}
          </h2>
          <p className="text-sm text-muted-foreground">
            Бесплатный расчёт и КП. Менеджер свяжется в течение 30 минут.
          </p>
        </div>
        <form
          method="POST"
          action="/api/leads"
          className="space-y-3"
        >
          <input type="hidden" name="source" value={`empty-category-${category.slug}`} />
          <input type="hidden" name="categorySlug" value={category.slug} />
          <input type="hidden" name="categoryName" value={category.name} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Имя *</span>
            <input
              type="text"
              name="name"
              required
              className="bg-background border border-border rounded-lg px-3 py-2 focus:border-gold/60 focus:outline-none"
              placeholder="Иван"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Телефон *</span>
            <input
              type="tel"
              name="phone"
              required
              className="bg-background border border-border rounded-lg px-3 py-2 focus:border-gold/60 focus:outline-none"
              placeholder="+7 ___ ___ __ __"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Что нужно (опционально)
            </span>
            <textarea
              name="comment"
              rows={3}
              className="bg-background border border-border rounded-lg px-3 py-2 focus:border-gold/60 focus:outline-none resize-none"
              placeholder="Марка стали, размеры, объём, сроки..."
            />
          </label>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3.5 rounded-lg transition-all"
          >
            <Send size={16} />
            Отправить заявку
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Нажимая кнопку, вы соглашаетесь с{" "}
            <Link href="/privacy" className="underline hover:text-gold">
              политикой обработки данных
            </Link>
            .
          </p>
        </form>
      </section>

      {/* Phone CTA bar */}
      <section className="bg-gradient-to-br from-gold/15 via-amber-500/10 to-gold/5 border border-gold/40 rounded-2xl p-6 md:p-8 text-center">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          Нужна срочная консультация?
        </h2>
        <p className="text-muted-foreground mb-5 max-w-2xl mx-auto">
          Менеджер ответит на любой вопрос о {category.name.toLowerCase()}: марки, ГОСТы, сроки,
          объёмы, доставка.
        </p>
        <a
          href={`tel:${CONTACT_PHONE_TEL}`}
          className="inline-flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-7 py-3.5 rounded-lg transition-all text-lg"
        >
          <Phone size={20} />
          {CONTACT_PHONE_DISPLAY}
        </a>
        <p className="text-xs text-muted-foreground mt-3">9:00–19:00 МСК · пн–пт</p>
      </section>

      {/* Back to catalog */}
      <div className="pt-6 border-t border-border">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-gold transition-colors"
        >
          ← Все разделы каталога
        </Link>
      </div>
    </article>
  );
}
