"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, ShoppingCart, FileDown } from "lucide-react";
import { weightPerMeter, searchQuery, type MetalType, type MetalDims } from "@/lib/metalCalc";

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

export default function EstimateCalc() {
  const [rows, setRows] = useState<Row[]>([
    { id: nextId++, label: "Труба 60×40×3", type: "truba_profile", dims: { a: 60, b: 40, t: 3 }, length: 6, qty: 10 },
    { id: nextId++, label: "Арматура ⌀12", type: "armatura", dims: { d: 12 }, length: 11.7, qty: 20 },
  ]);
  const [preset, setPreset] = useState("0");

  const addRow = () => {
    const p = PRESETS[parseInt(preset)] ?? PRESETS[0];
    setRows(r => [...r, { id: nextId++, ...p, length: 6, qty: 1 }]);
  };

  const remove = (id: number) => setRows(r => r.filter(row => row.id !== id));

  const updateRow = (id: number, field: keyof Row, value: any) =>
    setRows(r => r.map(row => row.id === id ? { ...row, [field]: value } : row));

  const getWeight = (row: Row) => {
    const wpm = weightPerMeter(row.type, row.dims);
    return wpm * row.length * row.qty;
  };

  const totalKg = rows.reduce((s, r) => s + getWeight(r), 0);
  const totalTons = totalKg / 1000;

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
              <th className="text-right px-3 py-2 text-muted-foreground font-medium w-28">Вес (кг)</th>
              <th className="text-right px-3 py-2 text-muted-foreground font-medium w-28">Тонны</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const kg = getWeight(row);
              const q = searchQuery(row.type, row.dims);
              return (
                <tr key={row.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2">
                    <Link href={`/search?q=${encodeURIComponent(q)}`}
                      className="text-gold hover:underline font-medium">{row.label}</Link>
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
                  <td className="px-3 py-2 text-right font-medium">{kg.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-bold text-gold">{(kg/1000).toFixed(4)}</td>
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
                <td className="px-3 py-3 text-right font-bold">{totalKg.toFixed(1)} кг</td>
                <td className="px-3 py-3 text-right font-bold text-gold text-lg">{totalTons.toFixed(3)} т</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Link href="/catalog"
            className="flex items-center gap-2 bg-gold hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-all">
            <ShoppingCart size={16} />
            Заказать металл по смете
          </Link>
          <button
            onClick={() => {
              const lines = ["Позиция\tДлина (м)\tКол-во\tВес (кг)\tТонны",
                ...rows.map(r => `${r.label}\t${r.length}\t${r.qty}\t${getWeight(r).toFixed(1)}\t${(getWeight(r)/1000).toFixed(4)}`),
                `ИТОГО\t\t\t${totalKg.toFixed(1)}\t${totalTons.toFixed(3)}`
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
