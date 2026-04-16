"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

interface SidebarCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  totalProducts: number;
  subcategories: { id: string; name: string; slug: string; productCount: number }[];
}

interface CatalogSidebarProps {
  categories: SidebarCategory[];
  activeCategorySlug?: string;
}

export default function CatalogSidebar({ categories, activeCategorySlug }: CatalogSidebarProps) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(activeCategorySlug || null);

  return (
    <aside className="w-[280px] flex-shrink-0 hidden lg:block">
      <div className="sticky top-[150px]">
        {/* Category list */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-bold uppercase tracking-wider">Каталог</h2>
          </div>
          <nav className="py-1">
            {categories.map((cat) => {
              const isActive = cat.slug === activeCategorySlug;
              const isExpanded = expandedSlug === cat.slug;
              return (
                <div key={cat.id}>
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors group ${
                      isActive
                        ? "text-gold font-semibold bg-gold/5"
                        : "text-foreground hover:text-gold hover:bg-muted/50"
                    }`}
                    onClick={() => setExpandedSlug(isExpanded ? null : cat.slug)}
                  >
                    <span className="text-sm flex-shrink-0 w-4 text-center">{cat.icon || "📦"}</span>
                    <Link
                      href={`/catalog/${cat.slug}`}
                      className="flex-1 text-sm truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {cat.name}
                    </Link>
                    {cat.totalProducts > 0 && (
                      <span className="text-xs text-muted-foreground mr-1">{cat.totalProducts}</span>
                    )}
                    <ChevronRight
                      size={14}
                      className={`flex-shrink-0 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      } group-hover:text-gold`}
                    />
                  </div>
                  {/* Subcategories */}
                  {isExpanded && cat.subcategories.length > 0 && (
                    <div className="bg-muted/30 border-t border-border">
                      {cat.subcategories.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/catalog/${cat.slug}/${sub.slug}`}
                          className="flex items-center justify-between px-4 pl-10 py-2 text-sm text-muted-foreground hover:text-gold transition-colors"
                        >
                          <span className="truncate">{sub.name}</span>
                          {sub.productCount > 0 && (
                            <span className="text-xs ml-2 flex-shrink-0">{sub.productCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
