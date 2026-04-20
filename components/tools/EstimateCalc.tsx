"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ShoppingCart, Check, FileDown, Loader2 } from "lucide-react";
import { weightPerMeter, searchQuery, type MetalType, type MetalDims } from "@/lib/metalCalc";
import { useCart } from "@/contexts/CartContext";
import type { ProductHit } from "@/hooks/useProductPrice";

interface Row {
  id: number;
  label: string;
  type: MetalType;
  dims: MetalDims;
  length: number;
  qty: number;
}

const PRESETS: { label: string; type: MetalType; dims: MetalDims }[] = [
  { label: "Арматура ⌀12", type: "armatura", dims: { d: 12 } },
  { label: "Арматура ⌀16", type: "armatura", dims: { d: 16 } },
  { label: "Труба 60×40×3", type: "truba_profile", dims: { a: 60, b: 40, t: 3 } },
  { label: "Труба 40×40×2", type: "truba_profile", dims: { a: 40, b: 40, t: 2 } },
  { label: "Уголок 50×5", type: "ugolok", dims: { a: 50, t: 5 } },
  { label: "Швеллер №10", type: "shveller", dims: { size: 10 } },
  { label: "Балка №20", type: "balka", dims: { size: 20 } },
  { label: "Круг ⌀20", type: "krug", dims: { d: 20 } },
  { label: "Полоса 40×4", type: "polosa", dims: { a: 40, b: 4 } },
];

const inp = "bg-background border border-border rounded px-2 py-1.5 text-sm text-foreground outline-none focus:border-gold transition-colors w-full";

let nextId = 1;

function rowTons(row: Row) {
  return weightPerMeter(row.type, row.dims) * row.length * row.qty / 1000;
}

function rowRub(row: Row, product: ProductHit | null) {
  if (!product?.price) return 0;
  const tons = rowTons(row);
  const u = (product.unit ?? "т").toLowerCase();
  if (u === "кг") return product.price * tons * 1000;
  if (u === "м" || u === "м.п." || u === "пм") return product.price * row.length * row.qty;
  return product.price * tons;
}

export default function EstimateCalc() {
  const [rows, setRows] = useState<Row[]>([
    { id: nextId++, label: "Труба 60×40×3", type: "truba_profile", dims: { a: 60, b: 40, t: 3 }, length: 6, qty: 10 },
    { id: nextId++, label: "Арматура ⌀12", type: "armatura", dims: { d: 12 }, length: 11.7, qty: 20 },
  ]);
  const [preset, setPreset] = useState("0");
  const [prices, setPrices] = useState<Record<number, ProductHit | null>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [addedAll, setAddedAll] = useState(false);
  const { addItem } = useCart();

  const fetchPrice = useCallback(async (row: Row) => {
    const q = searchQuery(row.type, row.dims);
    if (!q || q.length < 2) return;
    setLoadingIds(prev => new Set(prev).add(row.id));
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const data: ProductHit[] = await res.json();
      const hit = Array.isArray(data) ? (data.find(h => h.price !== null) ?? data[0] ?? null) : null;
      setPrices(prev => ({ ...prev, [row.id]: hit }));
    } catch {}
    setLoadingIds(prev => { const s = new Set(prev); s.delete(row.id); return s; });
  }, []);

  useEffect(() => {
    rows.forEach(row => {
      if (!(row.id in prices)) fetchPrice(row);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const addRow = () => {
    const p = PRESETS[parseInt(preset)] ?? PRESETS[0];
    setRows(r => [...r, { id: nextId++, ...p, length: 6, qty: 1 }]);
  };

  const remove = (id: number) => {
    setRows(r => r.filter(row => row.id !== id));
    setPrices(p => { const n = { ...p }; delete n[id]; return n; });
  };

  const updateRow = (id: number, field: keyof Row, value: any) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const totalKg = rows.reduce((s, r) => s + weightPerMeter(r.type, r.dims) * r.length * r.qty, 0);
  const totalTons = totalKg / 1000;
  const totalRub = rows.reduce((s, r) => s + rowRub(r, prices[r.id] ?? null), 0);

  const handleAddAll = () => {
    rows.forEach(row => {
      const product = prices[row.id];
      if (!product?.id) return;
      const tons = parseFloat(rowTons(row).toFixed(4));
      addItem({ id: product.id, name: product.name, slug: product.slug, unit: product.unit, price: product.price, image_url: product.image_url, tons, meters: row.length * row.qty });
    });
    setAddedAll(true);
    setTimeout(() => setAddedAll(false), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-muted-foreground mb-1">Добавить позицию</label>
          <select value={preset} onChange={e => setPreset(e.target.value)} className={inp + " max-w-xs"}>
            {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
        </div>
        <button onClick={addRow}
          className="flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg transition-all text-sm">
          <Plus size={16} /> Добавить
        </button>
      </div>

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
              const product = prices[row.id] ?? null;
              const rub = rowRub(row, product);
              const isLoading = loadingIds.has(row.id);
              return (
                <tr key={row.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{weightPerMeter(row.type, row.dims).toFixed(3)} кг/м</p>
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
                  <td className="px-3 py-2 text-right font-bold text-gold">{tons.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right">
                    {isLoading ? <Loader2 size={12} className="animate-spin inline text-muted-foreground" /> :
                      product?.price ? `${product.price.toLocaleString("ru-RU")}` : <span className="text-muted-foreground text-xs">—</span>}
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
          {rows.length > 0 && (
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
          )}
        </table>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAddAll}
            className={`flex items-center gap-2 font-bold px-6 py-3 rounded-lg transition-all ${
              addedAll ? "bg-emerald-500 text-white" : "bg-gold hover:bg-yellow-400 text-black"
            }`}>
            {addedAll ? <Check size={16} /> : <ShoppingCart size={16} />}
            {addedAll ? "Все позиции добавлены!" : `Добавить всё в корзину (${totalTons.toFixed(3)} т)`}
          </button>
          <button
            onClick={() => {
              const lines = ["Позиция\tДлина (м)\tКол-во\tТонны\tЦена ₽/т\tСумма ₽",
                ...rows.map(r => {
                  const p = prices[r.id];
                  return `${r.label}\t${r.length}\t${r.qty}\t${rowTons(r).toFixed(4)}\t${p?.price ?? ""}\t${Math.round(rowRub(r, p ?? null))}`;
                }),
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
