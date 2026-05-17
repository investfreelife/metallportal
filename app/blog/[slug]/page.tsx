import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Calendar, User } from "lucide-react";
import { getArticle, getAllSlugs, extractFAQ } from "@/lib/blog";
import ArticleRenderer from "@/components/blog/ArticleRenderer";
import RelatedArticles from "@/components/blog/RelatedArticles";
import { SITE_URL } from "@/lib/site";

interface Props {
  params: { slug: string };
}

/**
 * Static generation для всех 16 Юлиных articles на build time.
 * `dynamicParams = false` — unknown slug → 404 (safe).
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticle(params.slug);
  if (!article) return { title: "Не найдено" };
  const { frontmatter } = article;
  const url = `${SITE_URL}/blog/${params.slug}`;
  const ogImage = frontmatter.image
    ? frontmatter.image.startsWith("http")
      ? frontmatter.image
      : `${SITE_URL}${frontmatter.image}`
    : undefined;

  return {
    title: `${frontmatter.title} | Блог Харланметалл`,
    description: frontmatter.description,
    keywords: frontmatter.keywords?.join(", "),
    authors: frontmatter.author ? [{ name: frontmatter.author }] : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.description,
      url,
      type: "article",
      publishedTime: frontmatter.publishedAt,
      modifiedTime: frontmatter.updatedAt ?? frontmatter.publishedAt,
      authors: frontmatter.author ? [frontmatter.author] : undefined,
      images: ogImage ? [{ url: ogImage, alt: frontmatter.imageAlt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: frontmatter.title,
      description: frontmatter.description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default function ArticlePage({ params }: Props) {
  const article = getArticle(params.slug);
  if (!article) return notFound();
  const { frontmatter, body, readingTime, wordCount } = article;
  const url = `${SITE_URL}/blog/${params.slug}`;
  const faq = extractFAQ(body);

  const ogImage = frontmatter.image
    ? frontmatter.image.startsWith("http")
      ? frontmatter.image
      : `${SITE_URL}${frontmatter.image}`
    : undefined;

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: frontmatter.title,
    description: frontmatter.description,
    image: ogImage ? [ogImage] : undefined,
    datePublished: frontmatter.publishedAt,
    dateModified: frontmatter.updatedAt ?? frontmatter.publishedAt,
    author: { "@type": "Organization", name: frontmatter.author || "Харланметалл" },
    publisher: {
      "@type": "Organization",
      name: "Харланметалл",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    keywords: frontmatter.keywords,
    wordCount,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: frontmatter.title, item: url },
    ],
  };

  const faqSchema =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        }
      : null;

  const dateStr = new Date(frontmatter.publishedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="bg-background min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <article className="container-main max-w-4xl py-8 md:py-12">
        <nav aria-label="breadcrumb" className="text-sm text-muted-foreground mb-4">
          <a href="/" className="hover:text-gold">
            Главная
          </a>{" "}
          /{" "}
          <a href="/blog" className="hover:text-gold">
            Блог
          </a>{" "}
          / <span className="text-foreground/80">{frontmatter.title}</span>
        </nav>

        <header className="mb-8">
          {frontmatter.category && (
            <span className="inline-block bg-gold/15 text-gold text-sm font-semibold px-3 py-1 rounded mb-3">
              {frontmatter.category}
            </span>
          )}
          <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight tracking-tight mb-4">
            {frontmatter.title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
            {frontmatter.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground border-y border-border py-3">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              <time dateTime={frontmatter.publishedAt}>{dateStr}</time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              {readingTime} мин чтения
            </span>
            {frontmatter.author && (
              <span className="inline-flex items-center gap-1.5">
                <User size={14} />
                {frontmatter.author}
              </span>
            )}
          </div>
        </header>

        {frontmatter.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frontmatter.image}
            alt={frontmatter.imageAlt || frontmatter.title}
            className="w-full rounded-lg mb-8 max-h-[480px] object-cover"
            loading="eager"
          />
        )}

        <ArticleRenderer body={body} />

        <RelatedArticles slug={params.slug} />
      </article>
    </main>
  );
}
