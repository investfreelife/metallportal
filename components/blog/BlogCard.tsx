import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import type { Article } from "@/lib/blog";

/**
 * Listing card для blog article preview.
 *
 * Renders: hero image (or placeholder gradient) + category tag + title +
 * description + date + reading time. Click → /blog/<slug>.
 */
export default function BlogCard({ article }: { article: Article }) {
  const { slug, frontmatter, readingTime } = article;
  const dateStr = formatRuDate(frontmatter.publishedAt);

  return (
    <Link
      href={`/blog/${slug}`}
      className="group bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg hover:border-gold transition-all flex flex-col"
    >
      <div className="relative h-44 bg-gradient-to-br from-muted via-card to-muted">
        {frontmatter.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frontmatter.image}
            alt={frontmatter.imageAlt || frontmatter.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-20">
            📰
          </div>
        )}
        {frontmatter.category && (
          <span className="absolute top-3 left-3 inline-block bg-gold/90 text-black text-xs font-semibold px-2 py-1 rounded">
            {frontmatter.category}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-foreground text-base leading-tight mb-2 line-clamp-2 group-hover:text-gold transition-colors">
          {frontmatter.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-1">
          {frontmatter.description}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/80 mt-auto">
          <time dateTime={frontmatter.publishedAt}>{dateStr}</time>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {readingTime} мин
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatRuDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
