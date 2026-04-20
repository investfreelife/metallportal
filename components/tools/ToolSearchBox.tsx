"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import type { ProductHit } from "@/hooks/useProductPrice";

interface Props {
  placeholder?: string;
  initialQuery?: string;
  onSelect: (p: ProductHit) => void;
  selected: ProductHit | null;
  onClear: () => void;
}

export default function ToolSearchBox({ placeholder = "Найти товар...", initialQuery = "", onSelect, selected, onClear }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(initialQuery); }, [initialQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((val: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (val.trim().length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(val.trim())}&limit=10`);
        const data: ProductHit[] = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 280);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{selected.name}</p>
          <p className="text-xs text-muted-foreground">
            {selected.categoryName}{selected.weight_per_meter ? ` · ${selected.weight_per_meter} кг/м` : ""}
            {selected.price ? ` · ${selected.price.toLocaleString("ru-RU")} ₽/т` : ""}
          </p>
        </div>
        <button onClick={onClear} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" size={14} />}
        <input
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); search(e.target.value); }}
          onFocus={() => { if (results.length > 0) setOpen(true); else if (q.trim().length >= 2) search(q); }}
          placeholder={placeholder}
          className="w-full bg-background border-2 border-gold/40 focus:border-gold rounded-xl pl-9 pr-9 py-3 text-sm text-foreground outline-none transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-xl">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQ(""); setResults([]); setOpen(false); }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.categoryName}{p.weight_per_meter ? ` · ${p.weight_per_meter} кг/м` : ""}</p>
              </div>
              <span className="flex-shrink-0 text-sm font-bold text-gold whitespace-nowrap">
                {p.price ? `${p.price.toLocaleString("ru-RU")} ₽/т` : "по запросу"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
