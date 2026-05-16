"use client";

import { useMemo } from "react";

/**
 * Simple SVG line/bar chart — no external deps (Recharts not installed).
 * Renders 3 series: visits (bars), leads (overlay bars), spend (dashed line, right axis).
 *
 * ТЗ #050 v1 — упрощённая визуализация. Если Sergey попросит точнее —
 * добавим Recharts в Phase 2 + tooltips + legend toggling.
 */

interface Point {
  date: string;
  visits: number;
  leads: number;
  spend: number;
}

export default function DailyTrendChart({ points }: { points: Point[] }) {
  const { width, height, padding, maxV, maxS } = useMemo(() => {
    const padding = { top: 20, right: 50, bottom: 30, left: 40 };
    const width = 800;
    const height = 280;
    const maxV = Math.max(...points.map((p) => p.visits), 1);
    const maxS = Math.max(...points.map((p) => p.spend), 1);
    return { width, height, padding, maxV, maxS };
  }, [points]);

  if (points.length === 0) return null;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barW = Math.max(8, (plotW / points.length) * 0.7);

  const xScale = (i: number) => padding.left + (plotW / points.length) * (i + 0.5);
  const yV = (v: number) => padding.top + plotH - (v / maxV) * plotH;
  const yS = (s: number) => padding.top + plotH - (s / maxS) * plotH;

  const spendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yS(p.spend)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-72 text-white/70"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis labels (left = visits) */}
        {[0, 0.5, 1].map((t) => (
          <g key={`yv-${t}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + plotH * (1 - t)}
              y2={padding.top + plotH * (1 - t)}
              stroke="currentColor"
              strokeOpacity="0.1"
            />
            <text
              x={padding.left - 5}
              y={padding.top + plotH * (1 - t) + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity="0.5"
            >
              {Math.round(maxV * t)}
            </text>
          </g>
        ))}

        {/* Y-axis labels (right = spend) */}
        {[0, 0.5, 1].map((t) => (
          <text
            key={`ys-${t}`}
            x={width - padding.right + 5}
            y={padding.top + plotH * (1 - t) + 4}
            textAnchor="start"
            fontSize="10"
            fill="currentColor"
            opacity="0.5"
          >
            {Math.round(maxS * t).toLocaleString("ru-RU")}₽
          </text>
        ))}

        {/* Bars: visits */}
        {points.map((p, i) => (
          <g key={`bar-${i}`}>
            <rect
              x={xScale(i) - barW / 2}
              y={yV(p.visits)}
              width={barW}
              height={padding.top + plotH - yV(p.visits)}
              fill="rgba(168, 162, 158, 0.4)"
            />
            {/* leads overlay */}
            {p.leads > 0 && (
              <rect
                x={xScale(i) - barW / 2}
                y={yV(p.leads * (maxV / Math.max(...points.map((x) => x.leads), 1)))}
                width={barW}
                height={padding.top + plotH - yV(p.leads * (maxV / Math.max(...points.map((x) => x.leads), 1)))}
                fill="rgba(250, 204, 21, 0.7)"
              />
            )}
          </g>
        ))}

        {/* Spend line */}
        {maxS > 0 && (
          <path
            d={spendPath}
            stroke="#3b82f6"
            strokeWidth="2"
            strokeDasharray="4 3"
            fill="none"
          />
        )}

        {/* X-axis labels */}
        {points.map((p, i) =>
          i % Math.max(1, Math.floor(points.length / 7)) === 0 ? (
            <text
              key={`x-${i}`}
              x={xScale(i)}
              y={height - padding.bottom + 15}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              opacity="0.5"
            >
              {p.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>

      <div className="flex gap-4 text-xs text-white/60 mt-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-stone-400/40 rounded-sm" />
          Визиты (левая ось)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-yellow-400/70 rounded-sm" />
          Лиды (масштаб левой оси)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-blue-500" style={{ borderTop: "1px dashed #3b82f6" }} />
          Расход (правая ось)
        </span>
      </div>
    </div>
  );
}
