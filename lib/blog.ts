import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Blog data layer — reads markdown files из `content/blog/` (filesystem).
 *
 * ТЗ #BlogReader-F2.7 (Sergey directive 2026-05-17: «юлины статьи не размещены»).
 * Юлины 16 articles живут в repo как .md, frontmatter parses gray-matter.
 *
 * Frontmatter shape match'ит Юлин template: publishedAt / image / internal_links /
 * focus_keyword / status. NB: НЕ `date` / NOT `hero_image` — Юлин convention.
 */

const BLOG_DIR = path.join(process.cwd(), "content/blog");

export interface ArticleFrontmatter {
  title: string;
  description: string;
  keywords?: string[];
  focus_keyword?: string;
  slug: string;
  author: string;
  publishedAt: string; // YYYY-MM-DD
  updatedAt?: string;
  tags?: string[];
  category?: string;
  status?: "draft" | "published";
  image?: string;
  imageAlt?: string;
  internal_links?: string[];
}

export interface Article {
  slug: string;
  frontmatter: ArticleFrontmatter;
  body: string;
  wordCount: number;
  readingTime: number; // минут
}

function isMdFile(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith(".");
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter(isMdFile)
    .map((f) => f.replace(/\.md$/, ""));
}

export function getArticle(slug: string): Article | null {
  // Sanitize slug — path traversal guard.
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  const p = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf-8");
  const { data, content } = matter(raw);
  const fm = data as ArticleFrontmatter;
  // Ensure slug from frontmatter matches filename (sanity check, не блокер)
  if (fm.slug && fm.slug !== slug) {
    // Mismatch — use filename slug (URL source of truth)
    fm.slug = slug;
  } else if (!fm.slug) {
    fm.slug = slug;
  }
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    frontmatter: fm,
    body: content,
    wordCount,
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
  };
}

export function getAllArticles(): Article[] {
  return getAllSlugs()
    .map((slug) => getArticle(slug))
    .filter((a): a is Article => a !== null)
    .sort((a, b) =>
      (b.frontmatter.publishedAt ?? "").localeCompare(a.frontmatter.publishedAt ?? ""),
    );
}

/**
 * Related articles — heuristic: tag overlap > 0 first, then category match,
 * then first ~3 of same author. Excludes self.
 */
export function getRelatedArticles(slug: string, limit = 3): Article[] {
  const current = getArticle(slug);
  if (!current) return [];
  const all = getAllArticles().filter((a) => a.slug !== slug);
  const currentTags = new Set(current.frontmatter.tags ?? []);

  const scored = all.map((a) => {
    const tags = a.frontmatter.tags ?? [];
    const tagOverlap = tags.filter((t) => currentTags.has(t)).length;
    const categoryMatch =
      current.frontmatter.category &&
      a.frontmatter.category === current.frontmatter.category
        ? 1
        : 0;
    return { article: a, score: tagOverlap * 2 + categoryMatch };
  });

  // Prefer explicit `internal_links` references that target /blog/*
  const explicit = (current.frontmatter.internal_links ?? [])
    .filter((l) => l.startsWith("/blog/"))
    .map((l) => l.replace(/^\/blog\//, ""))
    .map((s) => all.find((a) => a.slug === s))
    .filter((a): a is Article => !!a);

  const remaining = scored
    .filter((s) => !explicit.some((e) => e.slug === s.article.slug))
    .sort((a, b) => b.score - a.score || (b.article.frontmatter.publishedAt ?? "").localeCompare(a.article.frontmatter.publishedAt ?? ""))
    .map((s) => s.article);

  return [...explicit, ...remaining].slice(0, limit);
}

/**
 * Extract FAQ Q/A pairs from markdown body — assumes structure:
 *   ## FAQ (or ## Часто задаваемые вопросы)
 *   ### Question text
 *   Answer paragraph(s)...
 *   ### Next question
 *   ...
 *
 * Used для JSON-LD FAQPage schema на article page.
 */
export function extractFAQ(body: string): Array<{ question: string; answer: string }> {
  const faqRe = /^##\s+(FAQ|Часто задаваемые вопросы|Вопросы и ответы)/im;
  const match = body.match(faqRe);
  if (!match) return [];
  const idx = body.indexOf(match[0]);
  const afterHeader = body.slice(idx + match[0].length);
  // Stop at next H2 (different section)
  const nextH2 = afterHeader.search(/^##\s+(?!#)/m);
  const faqSection = nextH2 >= 0 ? afterHeader.slice(0, nextH2) : afterHeader;

  const out: Array<{ question: string; answer: string }> = [];
  const qaRe = /^###\s+(.+?)\n([\s\S]*?)(?=^###\s+|\z)/gm;
  let m: RegExpExecArray | null;
  while ((m = qaRe.exec(faqSection)) !== null) {
    const question = m[1].trim();
    // Strip markdown formatting from answer (basic), keep text
    const answer = m[2]
      .trim()
      .replace(/\n{2,}/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\[(.+?)\]\([^)]+\)/g, "$1")
      .slice(0, 500);
    if (question && answer) out.push({ question, answer });
  }
  return out;
}
