import { createClient } from "@supabase/supabase-js";

/**
 * Marketing dashboard data queries — server-side (service_role bypass RLS).
 *
 * ТЗ #050 F3.6 (dashboard UI). Reads marketing_daily_summary view aggregated
 * from marketing_metrics. ETL writes (every 30 мин via GH Actions), dashboard reads.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type DateRange = "7d" | "30d" | "90d";

function daysBack(range: DateRange): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

function dateFromStr(range: DateRange): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack(range));
  return d.toISOString().slice(0, 10);
}

export interface DailySummaryRow {
  date: string;
  source: string;
  channel: string | null;
  visits: number | null;
  leads: number | null;
  spend: number | null;
  clicks: number | null;
  impressions: number | null;
  cpl: number | null;
  avg_position: number | null;
  revenue: number | null;
  call_count: number | null;
  call_duration_avg: number | null;
  call_missed: number | null;
}

export async function fetchDailySummary(range: DateRange): Promise<DailySummaryRow[]> {
  const since = dateFromStr(range);
  const { data, error } = await admin()
    .from("marketing_daily_summary")
    .select("*")
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) {
    console.error("[marketing/queries] fetchDailySummary error:", error);
    return [];
  }
  return (data ?? []) as DailySummaryRow[];
}

export interface KPI {
  visits: number;
  leads: number;
  spend: number;
  clicks: number;
  impressions: number;
  cpl: number | null;
  call_count: number;
  call_missed: number;
}

export function aggregateKPI(rows: DailySummaryRow[]): KPI {
  let visits = 0, leads = 0, spend = 0, clicks = 0, impressions = 0, call_count = 0, call_missed = 0;
  for (const r of rows) {
    visits += Number(r.visits ?? 0);
    leads += Number(r.leads ?? 0);
    spend += Number(r.spend ?? 0);
    clicks += Number(r.clicks ?? 0);
    impressions += Number(r.impressions ?? 0);
    call_count += Number(r.call_count ?? 0);
    call_missed += Number(r.call_missed ?? 0);
  }
  const cpl = leads > 0 ? spend / leads : null;
  return { visits, leads, spend, clicks, impressions, cpl, call_count, call_missed };
}

export interface ChannelBreakdown {
  channel: string;
  visits: number;
  leads: number;
  spend: number;
}

export function aggregateByChannel(rows: DailySummaryRow[]): ChannelBreakdown[] {
  const byChan: Record<string, ChannelBreakdown> = {};
  for (const r of rows) {
    const ch = r.channel ?? "unknown";
    if (!byChan[ch]) byChan[ch] = { channel: ch, visits: 0, leads: 0, spend: 0 };
    byChan[ch].visits += Number(r.visits ?? 0);
    byChan[ch].leads += Number(r.leads ?? 0);
    byChan[ch].spend += Number(r.spend ?? 0);
  }
  return Object.values(byChan).sort((a, b) => b.visits - a.visits);
}

export interface DailyTrendPoint {
  date: string;
  visits: number;
  leads: number;
  spend: number;
}

export function dailyTrend(rows: DailySummaryRow[]): DailyTrendPoint[] {
  const byDate: Record<string, DailyTrendPoint> = {};
  for (const r of rows) {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, visits: 0, leads: 0, spend: 0 };
    byDate[r.date].visits += Number(r.visits ?? 0);
    byDate[r.date].leads += Number(r.leads ?? 0);
    byDate[r.date].spend += Number(r.spend ?? 0);
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export interface TopPage {
  url: string;
  pageviews: number;
  users: number;
}

export async function fetchTopPages(range: DateRange, limit = 10): Promise<TopPage[]> {
  const since = dateFromStr(range);
  const { data, error } = await admin()
    .from("marketing_metrics")
    .select("metric_value, metric_meta")
    .eq("source", "metrika")
    .eq("metric_name", "pageviews")
    .gte("date", since)
    .order("metric_value", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[marketing/queries] fetchTopPages error:", error);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    url: String(r.metric_meta?.page_url ?? ""),
    pageviews: Number(r.metric_value),
    users: Number(r.metric_meta?.users ?? 0),
  }));
}

export interface TopQuery {
  query: string;
  impressions: number;
  avg_position: number | null;
}

export async function fetchTopQueries(range: DateRange, limit = 10): Promise<TopQuery[]> {
  const since = dateFromStr(range);
  const { data, error } = await admin()
    .from("marketing_metrics")
    .select("metric_value, metric_meta, metric_name")
    .eq("source", "webmaster")
    .eq("metric_name", "impressions")
    .gte("date", since)
    .order("metric_value", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[marketing/queries] fetchTopQueries error:", error);
    return [];
  }

  // Fetch positions for these queries
  const queries = (data ?? []).map((r: any) => String(r.metric_meta?.query ?? ""));
  let positions: Record<string, number> = {};
  if (queries.length > 0) {
    const { data: posData } = await admin()
      .from("marketing_metrics")
      .select("metric_value, metric_meta")
      .eq("source", "webmaster")
      .eq("metric_name", "avg_position")
      .gte("date", since);
    for (const p of (posData ?? []) as any[]) {
      const q = String(p.metric_meta?.query ?? "");
      if (q) positions[q] = Number(p.metric_value);
    }
  }

  return (data ?? []).map((r: any) => {
    const q = String(r.metric_meta?.query ?? "");
    return {
      query: q,
      impressions: Number(r.metric_value),
      avg_position: positions[q] ?? null,
    };
  });
}
