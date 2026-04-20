"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors";
const lbl = "block text-xs text-muted-foreground mb-1";

const SHEET_SIZES = [
  { label: "1500×6000 мм", w: 1500, h: 6000 },
  { label: "1250×2500 мм", w: 1250, h: 2500 },
  { label: "1500×3000 мм", w: 1500, h: 3000 },
  { label: "2000×6000 мм", w: 2000, h: 6000 },
  { label: "1000×2000 мм", w: 1000, h: 2000 },
];

export default function SheetCalc() {
  const [sheetPreset, setSheetPreset] = useState("0");
  const [sheetW, setSheetW] = useState("1500");
  const [sheetH, setSheetH] = useState("6000");
  const [partW, setPartW] = useState("200");
  const [partH, setPartH] = useState("300");
  const [kerf, setKerf] = useState("3");
  const [need, setNeed] = useState("50");
  const [thickness, setThickness] = useState("4");

  const applyPreset = (idx: string) => {
    setSheetPreset(idx);
    const p = SHEET_SIZES[parseInt(idx)];
    if (p) { setSheetW(String(p.w)); setSheetH(String(p.h)); }
  };

  const result = useMemo(() => {
    const SW = parseFloat(sheetW) || 0;
    const SH = parseFloat(sheetH) || 0;
    const PW = parseFloat(partW) || 0;
    const PH = parseFloat(partH) || 0;
    const K = parseFloat(kerf) || 3;
    const N = parseInt(need) || 0;
    const T = parseFloat(thickness) || 0;
    if (!SW || !SH || !PW || !PH) return null;

    const colsA = Math.floor(SW / (PW + K));
    const rowsA = Math.floor(SH / (PH + K));
    const perSheetA = colsA * rowsA;

    const colsB = Math.floor(SW / (PH + K));
    const rowsB = Math.floor(SH / (PW + K));
    const perSheetB = colsB * rowsB;

    const perSheet = Math.max(perSheetA, perSheetB);
    const rotation = perSheetB > perSheetA;

    const usageArea = perSheet * PW * PH;
    const sheetArea = SW * SH;
    const utilization = sheetArea > 0 ? (usageArea / sheetArea) * 100 : 0;
    const sheetsNeeded = N > 0 && perSheet > 0 ? Math.ceil(N / perSheet) : 0;
    const sheetWeightKg = SW * SH * T * 7.85e-9 * 1e6 / 1000;

    return { perSheet, rotation, utilization, sheetsNeeded, sheetWeightKg, totalWeightKg: sheetsNeeded * sheetWeightKg };
  }, [sheetW, sheetH, partW, partH, kerf, need, thickness]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div>
          <label className={lbl}>Стандартный размер листа</label>
          <select value={sheetPreset} onChange={e => applyPreset(e.target.value)} className={inp}>
            <option value="">— выбрать —</option>
            {SHEET_SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Ширина листа (мм)</label><input type="number" value={sheetW} onChange={e => setSheetW(e.target.value)} className={inp} min={1} /></div>
          <div><label className={lbl}>Длина листа (мм)</label><input type="number" value={sheetH} onChange={e => setSheetH(e.target.value)} className={inp} min={1} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Ширина детали (мм)</label><input type="number" value={partW} onChange={e => setPartW(e.target.value)} className={inp} min={1} /></div>
          <div><label className={lbl}>Высота детали (мм)</label><input type="number" value={partH} onChange={e => setPartH(e.target.value)} className={inp} min={1} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Ширина реза (мм)</label>
            <select value={kerf} onChange={e => setKerf(e.target.value)} className={inp}>
              {[1,2,3,4,5,6].map(v=><option key={v} value={v}>{v} мм</option>)}
            </select>
          </div>
          <div><label className={lbl}>Толщина листа (мм)</label><input type="number" value={thickness} onChange={e => setThickness(e.target.value)} className={inp} min={0.5} step={0.5} /></div>
        </div>
        <div><label className={lbl}>Нужно деталей (шт)</label><input type="number" value={need} onChange={e => setNeed(e.target.value)} className={inp} min={1} /></div>
      </div>

      <div className="bg-background border border-gold/30 rounded-xl p-5 flex flex-col justify-between gap-4">
        {result ? (
          <>
            <div className="space-y-3">
              <div className="flex justify-between text-sm border-b border-border pb-2">
                <span className="text-muted-foreground">Деталей с листа</span>
                <span className="font-bold">{result.perSheet} шт {result.rotation ? "(повёрнуто)" : ""}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-border pb-2">
                <span className="text-muted-foreground">Использование листа</span>
                <span className={`font-bold ${result.utilization > 70 ? "text-emerald-500" : result.utilization > 50 ? "text-amber-500" : "text-red-400"}`}>
                  {result.utilization.toFixed(1)}%
                </span>
              </div>
              {parseInt(need) > 0 && result.sheetsNeeded > 0 && <>
                <div className="flex justify-between text-sm border-b border-border pb-2">
                  <span className="text-muted-foreground">Листов нужно</span>
                  <span className="font-bold">{result.sheetsNeeded} шт</span>
                </div>
                <div className="flex justify-between text-sm border-b border-border pb-2">
                  <span className="text-muted-foreground">Вес листа</span>
                  <span className="font-bold">{result.sheetWeightKg.toFixed(1)} кг</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Итого</span>
                  <span className="text-2xl font-bold text-gold">{(result.totalWeightKg/1000).toFixed(3)} т</span>
                </div>
              </>}
            </div>
            <Link
              href={`/search?q=${encodeURIComponent(`лист ${thickness}`)}&limit=20`}
              className="flex items-center justify-center gap-2 w-full bg-gold hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all"
            >
              <ShoppingCart size={16} />
              Купить лист {thickness} мм
            </Link>
          </>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-8">Заполните размеры</p>
        )}
      </div>
    </div>
  );
}
