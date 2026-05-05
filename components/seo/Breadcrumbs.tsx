import Link from "next/link";
import { SITE_URL } from "@/lib/site";

/**
 * Single source of truth для хлебных крошек: визуальная навигация +
 * `BreadcrumbList` JSON-LD (schema.org) одним компонентом.
 *
 * Caller передаёт `items` БЕЗ "Главная" — она добавляется автоматически.
 * Пример (catalog root): `<Breadcrumbs items={[{ name: "Каталог" }]} />`.
 * Пример (category):     `<Breadcrumbs items={[
 *   { name: "Каталог", href: "/catalog" },
 *   { name: "Сортовой прокат" },
 * ]} />`.
 *
 * Item без `href` рендерится как plain `<span>` (текущая страница).
 * Item с `href` — как `<Link>`. JSON-LD `item` — всегда absolute URL
 * (используется `SITE_URL`); для последнего элемента `item` тоже включён,
 * Google рекомендует это для лучшего рендеринга в SERP.
 */

export type BreadcrumbItem = {
  /** Видимое название */
  name: string;
  /** Если задан — рендерится как ссылка. Pathname без домена (`/catalog/...`). */
  href?: string;
};

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const fullItems: BreadcrumbItem[] = [
    { name: "Главная", href: "/" },
    ...items,
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: fullItems.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      // Для current-page (без href) показываем canonical-ный URL текущей
      // страницы как последний href. Если caller не задал — fallback на
      // SITE_URL без path. Это лучше чем пустота.
      item: `${SITE_URL}${item.href ?? ""}`,
    })),
  };

  return (
    <>
      <nav
        aria-label="Хлебные крошки"
        className="text-sm text-muted-foreground mb-4"
      >
        {fullItems.map((item, idx) => {
          const isLast = idx === fullItems.length - 1;
          return (
            <span key={`${item.name}-${idx}`}>
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-gold transition-colors">
                  {item.name}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground" : ""}>{item.name}</span>
              )}
              {!isLast && <span className="mx-2">/</span>}
            </span>
          );
        })}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
