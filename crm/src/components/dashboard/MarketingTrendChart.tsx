"use client";

import { useMemo } from "react";

/**
 * Simple SVG line/bar chart — no external deps (Recharts not installed).
 * Renders 3 series: visits (bars), leads (overlay bars), spend (dashed line, right axis).
 *
 * Source: copied from metallportal/components/admin/operator/DailyTrendChart.tsx
 * за 2026-05-16 миграции /admin/operator → CRM dashboard (Pavel + Алексей).
 * Re-skinned под CRM gray palette (dashboard на белом фоне, не как раньше тёмный admin).
 */

interface Point {
  date: string;
  visits: number;
  leads: number;
  spend: number;
}

export default function MarketingTrendChart({ points }: { points: Point[] }) {
  const { width, height, padding, maxV, maxS } = useMemo(() => {
    const padding = { top: 16, right: 50, bottom: 24, left: 40 };
    const width = 800;
    const height = 240;
    const maxV = Math.max(...points.map((p) => p.visits), 1);
    const maxS = Math.max(...points.map((p) => p.spend), 1);
    return { width, height, padding, maxV, maxS };
  }, [points]);

  if (points.length === 0) return null;

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const barW = Math.max(6, (plotW / points.length) * 0.7);

  const xScale = (i: number) => padding.left + (plotW / points.length) * (i + 0.5);
  const yV = (v: number) => padding.top + plotH - (v / maxV) * plotH;
  const yS = (s: number) => padding.top + plotH - (s / maxS) * plotH;

  const maxLeads = Math.max(...points.map((p) => p.leads), 1);
  const leadsScale = maxV / maxLeads;

  const spendPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yS(p.spend)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-60 text-gray-500"
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
              strokeOpacity="0.12"
            />
            <text
              x={padding.left - 5}
              y={padding.top + plotH * (1 - t) + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity="0.6"
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
            opacity="0.6"
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
              fill="rgba(74, 144, 217, 0.35)"
            />
            {p.leads > 0 && (
              <rect
                x={xScale(i) - barW / 2}
                y={yV(p.leads * leadsScale)}
                width={barW}
                height={padding.top + plotH - yV(p.leads * leadsScale)}
                fill="rgba(46, 175, 130, 0.75)"
              />
            )}
          </g>
        ))}

        {/* Spend line */}
        {maxS > 0 && (
          <path
            d={spendPath}
            stroke="#EF9F27"
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
              y={height - padding.bottom + 14}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              opacity="0.6"
            >
              {p.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>

      <div className="flex gap-4 text-[11px] text-gray-500 mt-2 flex-wrap px-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-[#4A90D9]/35 rounded-sm" />
          Визиты (левая ось)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 bg-[#2EAF82]/75 rounded-sm" />
          Лиды (масштаб левой оси)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-[#EF9F27]" style={{ borderTop: "1px dashed #EF9F27" }} />
          Расход (правая ось)
        </span>
      </div>
    </div>
  );
}
