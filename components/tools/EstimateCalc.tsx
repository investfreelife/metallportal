"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, ShoppingCart, Check, FileDown, Loader2, Search, Plus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { ProductHit } from "@/hooks/useProductPrice";

interface EstimateRow {
  id: number;
  product: ProductHit;
  length: number;
  qty: number;
}

const inp = "bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold transition-colors w-full";

let nextId = 1;

function rowTons(row: EstimateRow): number {
  const wpm = row.product.weight_per_meter;
  const u = (row.product.unit ?? "т").toLowerCase();
  if (wpm && wpm > 0) return wpm * row.length * row.qty / 1000;
  if (u === "т" || u === "тонна") return row.qty;
  return 0;
}

function rowRub(row: EstimateRow): number {
  if (!row.product.price) return 0;
  const tons = rowTons(row);
  const u = (row.product.unit ?? "т").toLowerCase();
  if (u === "кг") return row.product.price * tons * 1000;
  if (u === "м" || u === "м.п." || u === "пм") return row.product.price * row.length * row.qty;
  return tons > 0 ? row.product.price * tons : 0;
}

function SearchBox({ onAdd }: { onAdd: (p: ProductHit) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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
        const res = await fetch(`/api/search?q=${encodeURIComponent(val.trim())}&limit=12`);
        const data: ProductHit[] = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 280);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-[280px]">
      <label className="block text-xs text-muted-foreground mb-1">Найти позицию в каталоге</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" size={14} />}
        <input
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="арматура 12, труба 60×40, балка 20..."
          className="w-full bg-background border-2 border-gold/40 focus:border-gold rounded-lg pl-9 pr-9 py-2.5 text-sm text-foreground outline-none transition-colors"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-xl">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onAdd(p); setQ(""); setResults([]); setOpen(false); }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.categoryName}{p.weight_per_meter ? ` · ${p.weight_per_meter} кг/м` : ""}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                {p.price ? <span className="text-sm font-bold text-gold">{p.price.toLocaleString("ru-RU")} ₽/т</span>
                  : <span className="text-xs text-muted-foreground">по запросу</span>}
                <Plus size={14} className="inline ml-2 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EstimateCalc() {
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [addedAll, setAddedAll] = useState(false);
  const { addItem } = useCart();

  const addProduct = (product: ProductHit) => {
    setRows(r => [...r, { id: nextId++, product, length: 6, qty: 1 }]);
  };

  const remove = (id: number) => setRows(r => r.filter(row => row.id !== id));

  const updateRow = (id: number, field: "length" | "qty", value: number) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const totalTons = rows.reduce((s, r) => s + rowTons(r), 0);
  const totalRub = rows.reduce((s, r) => s + rowRub(r), 0);

  const handleAddAll = () => {
    rows.forEach(row => {
      const tons = parseFloat(rowTons(row).toFixed(4));
      addItem({ id: row.product.id, name: row.product.name, slug: row.product.slug, unit: row.product.unit, price: row.product.price, image_url: row.product.image_url, tons: tons > 0 ? tons : undefined, meters: row.length * row.qty });
    });
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 2500);
  };

  return (
    <div className="space-y-4">
      <SearchBox onAdd={addProduct} />

      {rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Найдите позицию в поиске выше и добавьте в смету</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Позиция</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Длина (м)</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium w-20">Кол-во</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Тонны</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium w-32">Цена ₽/т</th>
                <th className="text-right px-3 py-2 text-muted-foreground font-medium w-32">Сумма ₽</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const tons = rowTons(row);
                const rub = rowRub(row);
                return (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.product.weight_per_meter ? `${row.product.weight_per_meter} кг/м · ` : ""}{row.product.categoryName}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.length} min={0} step={0.1}
                        onChange={e => updateRow(row.id, "length", parseFloat(e.target.value) || 0)}
                        className={inp + " text-right"} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.qty} min={1}
                        onChange={e => updateRow(row.id, "qty", parseInt(e.target.value) || 1)}
                        className={inp + " text-right"} />
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gold">{tons > 0 ? tons.toFixed(4) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {row.product.price ? row.product.price.toLocaleString("ru-RU") : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-500">
                      {rub > 0 ? Math.round(rub).toLocaleString("ru-RU") : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => remove(row.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-muted/30">
              <tr>
                <td colSpan={3} className="px-3 py-3 font-bold">ИТОГО</td>
                <td className="px-3 py-3 text-right font-bold text-gold text-lg">{totalTons.toFixed(3)} т</td>
                <td></td>
                <td className="px-3 py-3 text-right font-black text-emerald-500 text-lg">
                  {totalRub > 0 ? `${Math.round(totalRub).toLocaleString("ru-RU")} ₽` : "—"}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button onClick={handleAddAll}
            className={`flex items-center gap-2 font-bold px-6 py-3 rounded-lg transition-all ${
              addedAll ? "bg-emerald-500 text-white" : "bg-gold hover:bg-yellow-400 text-black"
            }`}>
            {addedAll ? <Check size={16} /> : <ShoppingCart size={16} />}
            {addedAll ? "Все позиции добавлены!" : `Добавить всё в корзину (${totalTons.toFixed(3)} т)`}
          </button>
          <button
            onClick={() => {
              const lines = ["Позиция\tДлина (м)\tКол-во\tТонны\tЦена ₽/т\tСумма ₽",
                ...rows.map(r => `${r.product.name}\t${r.length}\t${r.qty}\t${rowTons(r).toFixed(4)}\t${r.product.price ?? ""}\t${Math.round(rowRub(r))}`),
                `ИТОГО\t\t\t${totalTons.toFixed(3)}\t\t${Math.round(totalRub)}`
              ].join("\n");
              const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
              a.download = "smeta.csv"; a.click();
            }}
            className="flex items-center gap-2 border border-border hover:border-gold text-foreground px-6 py-3 rounded-lg transition-all text-sm font-medium">
            <FileDown size={16} />
            Скачать смету (.csv)
          </button>
        </div>
      )}
    </div>
  );
}
