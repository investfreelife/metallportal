import Link from "next/link";

interface SubcategoryInfo {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface CategoryCardProps {
  name: string;
  slug: string;
  icon?: string;
  imageUrl?: string;
  totalProducts: number;
  subcategories: SubcategoryInfo[];
}

export default function CatalogCategoryCard({
  name,
  slug,
  icon,
  imageUrl,
  totalProducts,
  subcategories,
}: CategoryCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 hover:border-gold/40 transition-all">
      <div className="flex gap-4 mb-4">
        {/* Category image or icon */}
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">{icon || "📦"}</span>
          )}
        </div>

        {/* Title and total */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/catalog/${slug}`}
            className="text-lg font-bold text-foreground hover:text-gold transition-colors block truncate"
          >
            {name}
          </Link>
          {totalProducts > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalProducts} {totalProducts === 1 ? "позиция" : totalProducts < 5 ? "позиции" : "позиций"}
            </span>
          )}
        </div>
      </div>

      {/* Subcategory links grid */}
      {subcategories.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/catalog/${slug}/${sub.slug}`}
              className="flex items-baseline gap-1 text-sm text-muted-foreground hover:text-gold hover:underline transition-colors truncate"
            >
              <span className="truncate">{sub.name}</span>
              {sub.productCount > 0 && (
                <span className="text-xs flex-shrink-0 opacity-60">{sub.productCount}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
