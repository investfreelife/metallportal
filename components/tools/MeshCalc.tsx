"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { ARMATURA_DIAMETERS } from "@/lib/metalCalc";

const ARMATURA_WPM: Record<number, number> = {
  6:0.222, 8:0.395, 10:0.617, 12:0.888, 14:1.208, 16:1.578,
  18:1.998, 20:2.466, 22:2.984, 25:3.853, 28:4.834, 32:6.313,
};
const inp = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors";
const lbl = "block text-xs text-muted-foreground mb-1";

export default function MeshCalc() {
  const [areaL, setAreaL] = useState("10");
  const [areaW, setAreaW] = useState("8");
  const [stepX, setStepX] = useState("200");
  const [stepY, setStepY] = useState("200");
  const [diam, setDiam] = useState("12");
  const [layers, setLayers] = useState("1");
  const [reserve, setReserve] = useState("10");

  const result = useMemo(() => {
    const L = parseFloat(areaL) || 0;
    const W = parseFloat(areaW) || 0;
    const sx = parseFloat(stepX) / 1000 || 0.2;
    const sy = parseFloat(stepY) / 1000 || 0.2;
    const d = parseInt(diam) || 12;
    const n = parseInt(layers) || 1;
    const res = 1 + (parseFloat(reserve) || 10) / 100;
    const wpm = ARMATURA_WPM[d] || 0;

    const rowsAlongX = Math.ceil(L / sx) + 1;
    const rowsAlongY = Math.ceil(W / sy) + 1;
    const meters = (rowsAlongX * W + rowsAlongY * L) * n * res;
    const kg = meters * wpm;
    const tons = kg / 1000;
    return { meters, kg, tons, d };
  }, [areaL, areaW, stepX, stepY, diam, layers, reserve]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Длина участка (м)</label><input type="number" value={areaL} onChange={e => setAreaL(e.target.value)} className={inp} min={0} /></div>
          <div><label className={lbl}>Ширина участка (м)</label><input type="number" value={areaW} onChange={e => setAreaW(e.target.value)} className={inp} min={0} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Шаг по длине (мм)</label>
            <select value={stepX} onChange={e => setStepX(e.target.value)} className={inp}>
              {[100,150,200,250,300].map(v=><option key={v} value={v}>{v} мм</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Шаг по ширине (мм)</label>
            <select value={stepY} onChange={e => setStepY(e.target.value)} className={inp}>
              {[100,150,200,250,300].map(v=><option key={v} value={v}>{v} мм</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Диаметр арматуры</label>
            <select value={diam} onChange={e => setDiam(e.target.value)} className={inp}>
              {ARMATURA_DIAMETERS.filter(d => d <= 20).map(d => <option key={d} value={d}>⌀{d} мм</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Слоёв сетки</label>
            <select value={layers} onChange={e => setLayers(e.target.value)} className={inp}>
              <option value="1">1 слой</option>
              <option value="2">2 слоя</option>
            </select>
          </div>
        </div>
        <div>
          <label className={lbl}>Запас на нахлёст (%)</label>
          <select value={reserve} onChange={e => setReserve(e.target.value)} className={inp}>
            {[5,10,15,20].map(v=><option key={v} value={v}>{v}%</option>)}
          </select>
        </div>
      </div>

      <div className="bg-background border border-gold/30 rounded-xl p-5 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm border-b border-border pb-2">
            <span className="text-muted-foreground">Площадь</span>
            <span className="font-bold">{((parseFloat(areaL)||0)*(parseFloat(areaW)||0)).toFixed(1)} м²</span>
          </div>
          <div className="flex justify-between text-sm border-b border-border pb-2">
            <span className="text-muted-foreground">Погонных метров</span>
            <span className="font-bold">{result.meters.toFixed(1)} м.п.</span>
          </div>
          <div className="flex justify-between text-sm border-b border-border pb-2">
            <span className="text-muted-foreground">Масса</span>
            <span className="font-bold">{result.kg.toFixed(1)} кг</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">Итого</span>
            <span className="text-2xl font-bold text-gold">{result.tons.toFixed(3)} т</span>
          </div>
          <p className="text-xs text-muted-foreground">Арматура ⌀{result.d} мм · {ARMATURA_WPM[result.d]} кг/м · с запасом {reserve}%</p>
        </div>
        <Link
          href={`/search?q=${encodeURIComponent(`арматура ${result.d}`)}&limit=20`}
          className="flex items-center justify-center gap-2 w-full bg-gold hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition-all"
        >
          <ShoppingCart size={16} />
          Купить арматуру ⌀{result.d}
        </Link>
      </div>
    </div>
  );
}
