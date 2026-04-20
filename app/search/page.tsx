"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart, Check, Loader2, ArrowLeft } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  unit: string;
  categoryName: string;
  price: number | null;
  href: string;
}

function ResultCard({ item }: { item: SearchResult }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({ id: item.id, name: item.name, slug: item.slug, unit: item.unit, price: item.price, image_url: item.image_url });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <Link
      href={item.href}
      className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 hover:border-gold/50 transition-all group"
    >
      <div className="w-14 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">📦</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base font-semibold text-foreground group-hover:text-gold transition-colors mb-0.5">
          {item.name}
        </div>
        <div className="text-xs text-muted-foreground">{item.categoryName}</div>
      </div>

      <div className="flex-shrink-0 text-right mr-2">
        {item.price ? (
          <div className="text-sm sm:text-base font-bold text-gold whitespace-nowrap">
            {item.price.toLocaleString("ru-RU")} ₽/{item.unit}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">По запросу</div>
        )}
      </div>

      <button
        onClick={handleCart}
        title="В корзину"
        className={`flex-shrink-0 w-9 h-9 rounded flex items-center justify-center transition-all ${
          added ? "bg-emerald-500/20 text-emerald-500" : "bg-gold/10 hover:bg-gold text-gold hover:text-black"
        }`}
      >
        {added ? <Check size={16} /> : <ShoppingCart size={16} />}
      </button>
    </Link>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [input, setInput] = useState(initialQ);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); setSearched(true); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=50`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ);
    else setSearched(false);
  }, [initialQ, doSearch]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    setQuery(input.trim());
    router.push(`/search?q=${encodeURIComponent(input.trim())}`, { scroll: false });
    doSearch(input.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-main py-6 max-w-3xl">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold transition-colors mb-5">
          <ArrowLeft size={16} /> Назад
        </button>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Найдите металл: арматура 12мм, труба 40×40..."
              autoFocus
              className="w-full bg-card border-2 border-gold rounded h-12 pl-10 pr-4 text-sm text-foreground outline-none"
            />
          </div>
          <button
            type="submit"
            className="bg-gold hover:bg-yellow-400 text-black font-semibold px-6 rounded h-12 transition-all text-sm flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Найти
          </button>
        </form>

        {/* Status */}
        {query && (
          <h1 className="text-xl font-bold text-foreground mb-4">
            {loading ? "Поиск..." : searched ? (
              results.length > 0
                ? `Найдено ${results.length} позиций по запросу «${query}»`
                : `По запросу «${query}» ничего не найдено`
            ) : ""}
          </h1>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="space-y-2">
            {results.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && searched && results.length === 0 && query && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 opacity-30">🔍</div>
            <p className="text-muted-foreground mb-2">Попробуйте изменить запрос</p>
            <p className="text-sm text-muted-foreground">Например: «арматура», «труба 40×40», «лист 3мм»</p>
            <Link href="/catalog" className="mt-6 inline-block text-gold hover:underline text-sm">
              Открыть каталог →
            </Link>
          </div>
        )}

        {/* No query yet */}
        {!searched && !query && (
          <p className="text-muted-foreground text-center py-10">Введите запрос и нажмите «Найти»</p>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 size={24} className="animate-spin text-gold" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}
