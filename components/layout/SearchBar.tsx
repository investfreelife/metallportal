"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, Mic, Loader2, ArrowRight } from "lucide-react";

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

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const saveSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    try {
      const prev: string[] = JSON.parse(localStorage.getItem("search_recent") ?? "[]");
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, 10);
      localStorage.setItem("search_recent", JSON.stringify(next));
    } catch {}
  }, []);

  const doSearch = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setResults(data);
          setActiveIndex(-1);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSubmit = (q: string = query) => {
    if (!q.trim()) return;
    saveSearch(q);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        saveSearch(query);
        router.push(results[activeIndex].href);
        setOpen(false);
      } else {
        handleSubmit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-3xl hidden sm:block">
      <div className="relative flex items-center bg-card border-2 border-gold rounded h-11 lg:h-12">
        <Search className="absolute left-3 text-muted-foreground" size={18} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Найдите металл: арматура 12мм, труба 40х40, лист 3мм..."
          className="w-full h-full bg-transparent pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          autoComplete="off"
        />
        <button
          onClick={() => handleSubmit()}
          className="absolute right-1 w-9 h-9 flex items-center justify-center bg-gold hover:bg-yellow-400 rounded transition-colors"
        >
          {loading ? <Loader2 className="animate-spin text-black" size={15} /> : <Mic className="text-black" size={16} />}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-2xl z-[100] overflow-hidden">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Поиск...
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Ничего не найдено по запросу «{query}»
            </div>
          )}

          {results.map((item, i) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => { saveSearch(query); setOpen(false); }}
              className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 transition-colors ${
                i === activeIndex ? "bg-gold/10" : "hover:bg-muted/60"
              }`}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-lg">📦</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                <div className="text-xs text-muted-foreground truncate">{item.categoryName}</div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0">
                {item.price ? (
                  <div className="text-sm font-bold text-gold">
                    {item.price.toLocaleString("ru-RU")} ₽/{item.unit}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">По запросу</div>
                )}
              </div>
            </Link>
          ))}

          {results.length > 0 && (
            <button
              onClick={() => handleSubmit()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gold hover:bg-gold/5 transition-colors font-medium"
            >
              Все результаты для «{query}»
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
