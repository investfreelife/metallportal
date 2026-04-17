import Link from "next/link";

interface CategoryCardProps {
  name: string;
  slug: string;
  icon?: string;
  imageUrl?: string;
  totalProducts: number;
  subcategories: any[];
  basePath: string; // e.g. "/catalog/metalloprokat" or "/catalog"
}

export default function CatalogCategoryCard({
  name,
  slug,
  icon,
  imageUrl,
  totalProducts,
  subcategories,
  basePath,
}: CategoryCardProps) {
  const cardHref = `${basePath}/${slug}`;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-gold/40 transition-all">
      {/* Full-width image area */}
      <div
        className="w-full h-44 bg-muted flex items-center justify-center overflow-hidden relative"
        data-photo-id={`category:${slug}`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl opacity-40">{icon || "📦"}</span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Link
            href={cardHref}
            className="text-base font-bold text-foreground hover:text-gold transition-colors leading-tight"
          >
            {name}
          </Link>
          {totalProducts > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
              {totalProducts} {totalProducts === 1 ? "позиция" : totalProducts < 5 ? "позиции" : "позиций"}
            </span>
          )}
        </div>

        {subcategories.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {subcategories.map((sub: any) => (
              <Link
                key={sub.id}
                href={`${cardHref}/${sub.slug}`}
                className="flex items-baseline gap-1 text-sm text-muted-foreground hover:text-gold hover:underline transition-colors truncate"
              >
                <span className="truncate">{sub.name}</span>
                {sub.totalProducts > 0 && (
                  <span className="text-xs flex-shrink-0 opacity-60">{sub.totalProducts}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
