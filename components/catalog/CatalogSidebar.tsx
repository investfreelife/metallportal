"use client";

import Link from "next/link";
import { ChevronRight, Menu, X, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useCatalogFiltersContent } from "@/contexts/CatalogFiltersContext";

interface CatalogSidebarProps {
  categories: any[];
}

export default function CatalogSidebar({ categories }: CatalogSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const filtersContent = useCatalogFiltersContent();

  const NavBlock = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <Link href="/catalog" className="text-sm font-bold uppercase tracking-wider hover:text-gold transition-colors" onClick={onNavigate}>
          Каталог
        </Link>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="py-1">
        {categories.map((cat: any) => (
          <SidebarLevel1 key={cat.id} cat={cat} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-[280px] flex-shrink-0 hidden lg:block">
        <div className="sticky top-[150px] max-h-[calc(100vh-180px)] overflow-y-auto scrollbar-none space-y-4">
          <NavBlock />
          {filtersContent && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal size={14} className="text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фильтры</h3>
              </div>
              {filtersContent}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 flex items-center gap-2 bg-gold text-black font-bold text-sm px-4 py-2.5 rounded-full shadow-lg"
      >
        <Menu size={16} />
        {filtersContent ? "Каталог + Фильтры" : "Каталог"}
      </button>

      {/* Mobile drawer — catalog nav + filters together */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-[300px] z-50 bg-background overflow-y-auto shadow-2xl lg:hidden">
            <div className="p-4 space-y-4">
              <NavBlock onNavigate={() => setMobileOpen(false)} />
              {filtersContent && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <SlidersHorizontal size={14} className="text-muted-foreground" />
                    <h3 className="text-sm font-bold text-foreground">Фильтры</h3>
                  </div>
                  {filtersContent}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SidebarLevel1({ cat, pathname, onNavigate }: { cat: any; pathname: string; onNavigate?: () => void }) {
  const href = `/catalog/${cat.slug}`;
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const [expanded, setExpanded] = useState(true);
  const hasSubs = cat.subcategories?.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors group ${
          isActive ? "text-gold font-semibold bg-gold/5" : "text-foreground hover:text-gold hover:bg-muted/50"
        }`}
        onClick={() => hasSubs && setExpanded((o: boolean) => !o)}
      >
        <span className="text-sm flex-shrink-0 w-5 text-center">{cat.icon || "📦"}</span>
        <Link href={href} className="flex-1 text-sm truncate" onClick={(e) => { e.stopPropagation(); onNavigate?.(); }}>
          {cat.name}
        </Link>
        {cat.totalProducts > 0 && (
          <span className="text-xs text-muted-foreground mr-1">{cat.totalProducts}</span>
        )}
        {hasSubs && (
          <ChevronRight
            size={14}
            className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            } group-hover:text-gold`}
          />
        )}
      </div>
      {expanded && hasSubs && (
        <div className="bg-muted/20">
          {cat.subcategories.map((sub: any) => (
            <SidebarLevel2 key={sub.id} sub={sub} parentSlug={cat.slug} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLevel2({ sub, parentSlug, pathname, onNavigate }: { sub: any; parentSlug: string; pathname: string; onNavigate?: () => void }) {
  const href = `/catalog/${parentSlug}/${sub.slug}`;
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const [expanded, setExpanded] = useState(isActive);
  const hasSubs = sub.subcategories?.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 pl-9 pr-4 py-2 cursor-pointer transition-colors group ${
          isActive ? "text-gold font-medium" : "text-muted-foreground hover:text-gold"
        }`}
        onClick={() => hasSubs && setExpanded((o: boolean) => !o)}
      >
        <Link href={href} className="flex-1 text-sm truncate" onClick={(e) => { e.stopPropagation(); onNavigate?.(); }}>
          {sub.name}
        </Link>
        {sub.totalProducts > 0 && (
          <span className="text-xs opacity-60 mr-1">{sub.totalProducts}</span>
        )}
        {hasSubs && (
          <ChevronRight
            size={12}
            className={`flex-shrink-0 opacity-40 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        )}
      </div>
      {expanded && hasSubs && (
        <div>
          {sub.subcategories.map((l3: any) => {
            const l3href = `/catalog/${parentSlug}/${sub.slug}/${l3.slug}`;
            const l3Active = pathname === l3href || pathname.startsWith(l3href + "/");
            return (
              <Link
                key={l3.id}
                href={l3href}
                className={`block pl-14 pr-4 py-1.5 text-xs transition-colors ${
                  l3Active ? "text-gold font-medium" : "text-muted-foreground hover:text-gold"
                }`}
              >
                <span className="truncate">{l3.name}</span>
                {l3.totalProducts > 0 && (
                  <span className="ml-1 opacity-60">{l3.totalProducts}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
