import { Suspense } from "react";
import { Phone, TrendingUp, MousePointerClick, Wallet, Target, PhoneOff } from "lucide-react";
import {
  fetchDailySummary,
  fetchTopPages,
  fetchTopQueries,
  aggregateKPI,
  aggregateByChannel,
  dailyTrend,
  type DateRange,
} from "@/lib/marketing/queries";
import DailyTrendChart from "@/components/admin/operator/DailyTrendChart";

/**
 * Operator Dashboard — ТЗ #050 F3.6. Sergey opens `/admin/operator` чтобы видеть
 * marketing health: visits / leads / CPL / channel split / top pages / search queries / calls.
 *
 * Server component — fetches от Supabase marketing_daily_summary view.
 * ETL пушит данные каждые 30 мин (GH Actions cron etl-marketing.yml).
 *
 * Reachability: AdminGuard wrapper в app/admin/layout.tsx requires role='admin'.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
];

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

export default async function OperatorPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const range: DateRange =
    searchParams.range === "30d" || searchParams.range === "90d"
      ? (searchParams.range as DateRange)
      : "7d";

  const rows = await fetchDailySummary(range);
  const [topPages, topQueries] = await Promise.all([
    fetchTopPages(range, 10),
    fetchTopQueries(range, 10),
  ]);
  const kpi = aggregateKPI(rows);
  const byChannel = aggregateByChannel(rows);
  const trend = dailyTrend(rows);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Маркетинг — Operator</h1>
          <p className="text-sm text-white/60">
            Realtime metrics: Metrika · Direct · Webmaster · Voximplant calls. Update every 30 min.
          </p>
        </div>
        <nav className="flex gap-1 bg-white/5 rounded-lg p-1 text-sm">
          {RANGES.map((r) => (
            <a
              key={r.value}
              href={`?range=${r.value}`}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                r.value === range ? "bg-yellow-500 text-black font-semibold" : "hover:bg-white/10"
              }`}
            >
              {r.label}
            </a>
          ))}
        </nav>
      </header>

      {/* KPI grid */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp size={18} />} label="Визиты" value={fmt(kpi.visits)} />
        <KpiCard icon={<Target size={18} />} label="Лиды" value={fmt(kpi.leads)} accent />
        <KpiCard icon={<MousePointerClick size={18} />} label="Клики" value={fmt(kpi.clicks)} />
        <KpiCard icon={<Wallet size={18} />} label="Расход" value={fmtMoney(kpi.spend)} />
        <KpiCard icon={<Target size={18} />} label="CPL" value={fmtMoney(kpi.cpl)} />
        <KpiCard
          icon={kpi.call_missed > 0 ? <PhoneOff size={18} /> : <Phone size={18} />}
          label="Звонки"
          value={`${kpi.call_count} / ${kpi.call_missed} проп.`}
        />
      </section>

      {/* Daily trend chart */}
      <section className="bg-white/5 rounded-xl p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3">Динамика по дням</h2>
        {trend.length > 0 ? (
          <DailyTrendChart points={trend} />
        ) : (
          <EmptyState text="Нет данных за выбранный период. ETL запустится через cron в ближайшие 30 мин." />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel breakdown */}
        <section className="bg-white/5 rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Каналы трафика</h2>
          {byChannel.length > 0 ? (
            <ChannelTable rows={byChannel} />
          ) : (
            <EmptyState text="Данных пока нет." />
          )}
        </section>

        {/* SEO queries */}
        <section className="bg-white/5 rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Топ-запросы (Webmaster)</h2>
          {topQueries.length > 0 ? (
            <QueriesTable rows={topQueries} />
          ) : (
            <EmptyState text="Webmaster требует verify host и индексацию (1-2 недели после launch)." />
          )}
        </section>
      </div>

      {/* Top pages */}
      <section className="bg-white/5 rounded-xl p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3">Топ-страницы (Metrika)</h2>
        {topPages.length > 0 ? (
          <PagesTable rows={topPages} />
        ) : (
          <EmptyState text="Metrika counter создан 2026-05-16 — данные начнут поступать после установки snippet (NEXT_PUBLIC_YANDEX_METRIKA_ID=109255193 + redeploy)." />
        )}
      </section>

      {/* System status footer */}
      <footer className="text-xs text-white/40 space-y-1 pt-4 border-t border-white/10">
        <p>Counter Metrika: <code className="text-white/60">109255193</code> · 5 conversion goals активны</p>
        <p>ETL cron: 30 мин (GH Actions etl-marketing.yml — 4 sources matrix)</p>
        <p>BLOCKED: Yandex Direct API access (Sergey должен подать заявку на API в Direct UI)</p>
      </footer>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${accent ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-white/5"}`}>
      <div className="flex items-center gap-2 text-xs text-white/60 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent ? "text-yellow-400" : ""}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-white/50 italic py-6">{text}</div>;
}

function ChannelTable({ rows }: { rows: { channel: string; visits: number; leads: number; spend: number }[] }) {
  const total = rows.reduce((s, r) => s + r.visits, 0) || 1;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-white/50 border-b border-white/10">
        <tr>
          <th className="text-left py-2">Канал</th>
          <th className="text-right py-2">Визиты</th>
          <th className="text-right py-2">Лиды</th>
          <th className="text-right py-2">Расход</th>
          <th className="text-right py-2 hidden md:table-cell">Доля</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.channel} className="border-b border-white/5 last:border-0">
            <td className="py-2">{r.channel}</td>
            <td className="text-right tabular-nums">{r.visits.toLocaleString("ru-RU")}</td>
            <td className="text-right tabular-nums">{r.leads.toLocaleString("ru-RU")}</td>
            <td className="text-right tabular-nums">{r.spend > 0 ? r.spend.toLocaleString("ru-RU") + " ₽" : "—"}</td>
            <td className="text-right tabular-nums hidden md:table-cell">{Math.round((r.visits / total) * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PagesTable({ rows }: { rows: { url: string; pageviews: number; users: number }[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-white/50 border-b border-white/10">
        <tr>
          <th className="text-left py-2">URL</th>
          <th className="text-right py-2">Просмотры</th>
          <th className="text-right py-2 hidden md:table-cell">Пользователи</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-white/5 last:border-0">
            <td className="py-2 truncate max-w-xs md:max-w-md" title={r.url}>{r.url}</td>
            <td className="text-right tabular-nums">{r.pageviews.toLocaleString("ru-RU")}</td>
            <td className="text-right tabular-nums hidden md:table-cell">{r.users.toLocaleString("ru-RU")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QueriesTable({ rows }: { rows: { query: string; impressions: number; avg_position: number | null }[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-white/50 border-b border-white/10">
        <tr>
          <th className="text-left py-2">Запрос</th>
          <th className="text-right py-2">Показы</th>
          <th className="text-right py-2 hidden md:table-cell">Поз.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-white/5 last:border-0">
            <td className="py-2 truncate max-w-xs" title={r.query}>{r.query}</td>
            <td className="text-right tabular-nums">{r.impressions.toLocaleString("ru-RU")}</td>
            <td className="text-right tabular-nums hidden md:table-cell">
              {r.avg_position ? r.avg_position.toFixed(1) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
