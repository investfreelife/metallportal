import { TrendingUp, MousePointerClick, Wallet, Target, Phone, PhoneOff, Search } from "lucide-react";
import {
  fetchDailySummary,
  fetchTopPages,
  fetchTopQueries,
  aggregateKPI,
  dailyTrend,
} from "@/lib/marketing/queries";
import MarketingTrendChart from "@/components/dashboard/MarketingTrendChart";

/**
 * MarketingWidgets — server component, fetches от Supabase marketing_daily_summary
 * + marketing_metrics (Metrika top pages / Webmaster top queries).
 *
 * История: эти widgets жили в metallportal/app/admin/operator/page.tsx (ТЗ #050).
 * 2026-05-16 Sergey directive «это должно быть в срм!» — перенесли в CRM (Pavel + Алексей).
 *
 * Источник данных: ETL пушит каждые 30 мин via GH Actions etl-marketing.yml в shared
 * Supabase (`tmzqirzyvmnkzfmotlcj.supabase.co`), Vercel CRM читает напрямую same DB.
 */

export const dynamic = "force-dynamic";

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M" + suffix;
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K" + suffix;
  return Math.round(n).toLocaleString("ru-RU") + suffix;
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("ru-RU") + " ₽";
}

export default async function MarketingWidgets() {
  const range = "30d" as const;
  const [rows, topPages, topQueries] = await Promise.all([
    fetchDailySummary(range),
    fetchTopPages(range, 5),
    fetchTopQueries(range, 5),
  ]);

  const kpi = aggregateKPI(rows);
  const trend = dailyTrend(rows);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-gray-800">Маркетинг — 30 дней</h2>
        <span className="text-[10px] text-gray-400">ETL каждые 30 мин · Metrika · Direct · Webmaster · Voximplant</span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <MarketingKpiCard icon={<TrendingUp size={16} />} label="Визиты" value={fmt(kpi.visits)} color="#4A90D9" />
        <MarketingKpiCard icon={<Target size={16} />} label="Лиды" value={fmt(kpi.leads)} color="#2EAF82" accent />
        <MarketingKpiCard icon={<MousePointerClick size={16} />} label="Клики" value={fmt(kpi.clicks)} color="#888780" />
        <MarketingKpiCard icon={<Wallet size={16} />} label="Расход" value={fmtMoney(kpi.spend)} color="#EF9F27" />
        <MarketingKpiCard icon={<Target size={16} />} label="CPL" value={fmtMoney(kpi.cpl)} color="#1a56db" />
        <MarketingKpiCard
          icon={kpi.call_missed > 0 ? <PhoneOff size={16} /> : <Phone size={16} />}
          label="Звонки"
          value={`${kpi.call_count} / ${kpi.call_missed} проп.`}
          color={kpi.call_missed > 0 ? "#E24B4A" : "#27A882"}
        />
      </div>

      {/* Daily trend chart */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <span className="text-[12px] font-medium text-gray-700">Динамика по дням</span>
          <span className="text-[10px] text-gray-400">визиты · лиды · расход</span>
        </div>
        <div className="p-3">
          {trend.length > 0 ? (
            <MarketingTrendChart points={trend} />
          ) : (
            <EmptyState text="Нет данных за выбранный период. ETL запустится через cron в ближайшие 30 мин." />
          )}
        </div>
      </div>

      {/* Top pages + Top queries side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-700">Топ-страницы (Metrika)</span>
            <span className="text-[10px] text-gray-400">{topPages.length} строк</span>
          </div>
          {topPages.length > 0 ? (
            <TopPagesTable rows={topPages} />
          ) : (
            <EmptyState text="Metrika counter создан 2026-05-16 — данные начнут поступать после установки snippet (NEXT_PUBLIC_YANDEX_METRIKA_ID=109255193 + redeploy)." />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-[12px] font-medium text-gray-700">Топ-запросы (Webmaster)</span>
            <span className="text-[10px] text-gray-400 inline-flex items-center gap-1"><Search size={11} />{topQueries.length} строк</span>
          </div>
          {topQueries.length > 0 ? (
            <TopQueriesTable rows={topQueries} />
          ) : (
            <EmptyState text="Webmaster требует verify host и индексацию (1-2 недели после launch)." />
          )}
        </div>
      </div>
    </section>
  );
}

function MarketingKpiCard({
  icon,
  label,
  value,
  color,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  accent?: boolean;
}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-xl"
      style={{ padding: "12px", borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
        <span style={{ color }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-[22px] font-medium leading-tight" style={{ color: accent ? color : "#111827" }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-[12px] text-gray-400 italic p-4">{text}</div>;
}

function TopPagesTable({ rows }: { rows: { url: string; pageviews: number; users: number }[] }) {
  return (
    <table className="w-full text-[12px]">
      <thead className="text-[10px] text-gray-500 uppercase tracking-wider">
        <tr>
          <th className="text-left px-4 py-2 font-medium">URL</th>
          <th className="text-right px-4 py-2 font-medium">Просмотры</th>
          <th className="text-right px-4 py-2 font-medium hidden md:table-cell">Пользователи</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="px-4 py-2 truncate max-w-xs md:max-w-md text-gray-700" title={r.url}>{r.url || "—"}</td>
            <td className="px-4 py-2 text-right tabular-nums text-gray-900">{r.pageviews.toLocaleString("ru-RU")}</td>
            <td className="px-4 py-2 text-right tabular-nums hidden md:table-cell text-gray-500">{r.users.toLocaleString("ru-RU")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopQueriesTable({ rows }: { rows: { query: string; impressions: number; avg_position: number | null }[] }) {
  return (
    <table className="w-full text-[12px]">
      <thead className="text-[10px] text-gray-500 uppercase tracking-wider">
        <tr>
          <th className="text-left px-4 py-2 font-medium">Запрос</th>
          <th className="text-right px-4 py-2 font-medium">Показы</th>
          <th className="text-right px-4 py-2 font-medium hidden md:table-cell">Позиция</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="px-4 py-2 truncate max-w-xs text-gray-700" title={r.query}>{r.query || "—"}</td>
            <td className="px-4 py-2 text-right tabular-nums text-gray-900">{r.impressions.toLocaleString("ru-RU")}</td>
            <td className="px-4 py-2 text-right tabular-nums hidden md:table-cell text-gray-500">
              {r.avg_position ? r.avg_position.toFixed(1) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
