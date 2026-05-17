import Link from "next/link";
import { getRelatedArticles } from "@/lib/blog";

export default function RelatedArticles({ slug }: { slug: string }) {
  const related = getRelatedArticles(slug, 3);
  if (related.length === 0) return null;

  return (
    <section className="border-t border-border pt-8 mt-12">
      <h2 className="text-2xl font-bold mb-6 text-foreground">Похожие статьи</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {related.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="block bg-card border border-border rounded-lg p-4 hover:border-gold hover:shadow-md transition-all"
          >
            {a.frontmatter.category && (
              <span className="inline-block bg-gold/10 text-gold text-xs font-medium px-2 py-0.5 rounded mb-2">
                {a.frontmatter.category}
              </span>
            )}
            <h3 className="font-semibold text-foreground leading-tight line-clamp-3 hover:text-gold transition-colors">
              {a.frontmatter.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-2">{a.readingTime} мин чтения</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
