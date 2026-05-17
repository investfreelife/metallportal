import type { Metadata } from "next";
import { getAllArticles } from "@/lib/blog";
import BlogCard from "@/components/blog/BlogCard";
import { SITE_URL } from "@/lib/site";

/**
 * Blog listing — `/blog`.
 *
 * Static-generated (ISR not needed — articles updated через commit to repo,
 * rebuild triggers fresh content). Lists all articles sorted by publishedAt desc.
 *
 * SEO: title + description + canonical + OG + JSON-LD ItemList.
 */

export const metadata: Metadata = {
  title: "Блог Харланметалл — статьи о металлопрокате, ГОСТ, доставке, ценах",
  description:
    "Профессиональные статьи о металлопрокате: сравнение марок стали ГОСТ/DIN/ASTM, как читать паспорт качества, выбор поставщика, доставка по России, B2B-маркетплейс.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "Блог Харланметалл — экспертные материалы о металлопрокате",
    description:
      "Гиды для снабженцев и закупщиков: марки стали, сертификаты, логистика, выбор поставщика.",
    url: `${SITE_URL}/blog`,
    type: "website",
  },
};

export default function BlogIndexPage() {
  const articles = getAllArticles();

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/blog/${a.slug}`,
      name: a.frontmatter.title,
    })),
  };

  return (
    <main className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <div className="container-main py-8 md:py-12">
        <header className="mb-8 md:mb-12">
          <nav aria-label="breadcrumb" className="text-sm text-muted-foreground mb-3">
            <a href="/" className="hover:text-gold">
              Главная
            </a>{" "}
            / Блог
          </nav>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mb-3">Блог Харланметалл</h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Экспертные статьи о металлопрокате: марки стали, ГОСТ vs ТУ, сертификаты, доставка,
            как читать паспорт качества и выбирать поставщика.
          </p>
        </header>

        {articles.length === 0 ? (
          <p className="text-muted-foreground italic">Статьи скоро появятся.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {articles.map((a) => (
              <BlogCard key={a.slug} article={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
