import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";

/**
 * Markdown → React rendering для blog articles. RSC-mode (server-only),
 * no client JS bundle weight.
 *
 * Custom components map: external/internal links + image lazy loading + headings
 * с anchor-able id для FAQPage JSON-LD targeting.
 */

const components = {
  a: (props: React.ComponentProps<"a">) => {
    const href = props.href ?? "";
    const isInternal = href.startsWith("/") || href.startsWith("#");
    if (isInternal) {
      return (
        <Link href={href} className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold transition-colors">
          {props.children}
        </Link>
      );
    }
    return (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold transition-colors"
      >
        {props.children}
      </a>
    );
  },
  img: (props: React.ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      loading="lazy"
      className="rounded-lg my-6 max-w-full h-auto"
      alt={props.alt ?? ""}
    />
  ),
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      {...props}
      id={slugifyHeading(asText(props.children))}
      className="text-2xl md:text-3xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3
      {...props}
      id={slugifyHeading(asText(props.children))}
      className="text-xl md:text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24"
    />
  ),
  h4: (props: React.ComponentProps<"h4">) => (
    <h4 {...props} className="text-lg font-semibold text-foreground mt-6 mb-2" />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p {...props} className="text-foreground/90 leading-relaxed my-4" />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul {...props} className="list-disc list-outside ml-6 my-4 space-y-2 text-foreground/90" />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol {...props} className="list-decimal list-outside ml-6 my-4 space-y-2 text-foreground/90" />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      {...props}
      className="border-l-4 border-gold pl-4 my-6 italic text-foreground/80 bg-gold/5 py-3 rounded-r"
    />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code {...props} className="bg-muted text-foreground px-1.5 py-0.5 rounded text-sm font-mono" />
  ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre {...props} className="bg-muted p-4 rounded-lg overflow-x-auto my-6 text-sm" />
  ),
  table: (props: React.ComponentProps<"table">) => (
    <div className="overflow-x-auto my-6">
      <table {...props} className="w-full text-sm border-collapse border border-border" />
    </div>
  ),
  th: (props: React.ComponentProps<"th">) => (
    <th {...props} className="border border-border bg-muted px-3 py-2 text-left font-semibold" />
  ),
  td: (props: React.ComponentProps<"td">) => (
    <td {...props} className="border border-border px-3 py-2 text-foreground/90" />
  ),
  hr: () => <hr className="border-border my-8" />,
};

function asText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(asText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return asText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\sа-я-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export default function ArticleRenderer({ body }: { body: string }) {
  return (
    <div className="prose-blog max-w-none">
      <MDXRemote source={body} components={components} />
    </div>
  );
}
