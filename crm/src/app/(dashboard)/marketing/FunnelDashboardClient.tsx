'use client';

import { useEffect, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

/**
 * /marketing → таб «🔻 Воронка-дашборд» (ТЗ-074).
 *
 * Главный экран маркетинга мирового уровня:
 *   ① Карточки инструментов (auto-discovered из byChannel), клик → отчёт
 *   ② Графическая воронка ① → охват → просмотры → лиды (SVG-трапеция)
 *   ③ Таблица «Эффективность площадок» с CR % + CPL ₽/лид
 *   ④ Средний CPL внизу.
 *
 * Все числа из /api/recruit/marketing/command-center (источник правды:
 * source_codes реестр + contacts.source_code). Никаких машин/поездок/парка.
 * Где данных нет — честная пометка (views органики, бесплатные каналы).
 */

interface PlanFactRow {
  key: string;
  name: string;
  tier: 1 | 2 | 3;
  status: string;
  planned_audience: number;
  actual_posts: number;
  actual_audience: number;
  actual_leads: number;
  actual_leads_attributed?: number;  // ТЗ-078: из них к посту
  actual_couriers?: number;          // ТЗ-078: вышли на линию
  actual_views: number;
  views_seen: boolean;
  actual_cost: number;
  actual_cpl: number | null;
  today_posts: number;
  today_audience: number;
  actual_deleted: number;
  actual_blocked: number;
  actual_comments: number;
  actual_cr: number | null;
  cr_to_courier?: number | null;     // ТЗ-078
}
interface CCResp {
  funnel: {
    reach: number; leads: number; hires: number;
    couriers?: number;                                  // ТЗ-078 alias
    leads_attributed?: number;                          // ТЗ-078
    views: number; views_available: boolean;
    cost: number; avg_cpl: number | null;
    cpc?: number | null;                                // ТЗ-078 cost per courier
    cr_lead: number | null; cr_hire: number | null;
    cr_lead_to_courier?: number | null;                 // ТЗ-078
    cr_reach_to_courier?: number | null;                // ТЗ-078
  };
  plan_fact: PlanFactRow[];
}
interface PostHistoryItem {
  id: string;
  code: string | null;
  placement: string | null;
  post_ref: string | null;
  placed_at: string;
  post_url: string | null;
  audience: number | null;
  leads: number;
  views: number | null;
  comments: number | null;
  status: string;
  cr: number | null;
}

const fmt = (n: number) => n.toLocaleString('ru-RU');

export default function FunnelDashboardClient() {
  const [data, setData] = useState<CCResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  async function reload() {
    setLoading(true); setErr(null);
    try {
      const j = await safeFetchJson<CCResp>('/api/recruit/marketing/command-center');
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  if (loading) return <p className="text-xs text-gray-400 py-8 text-center">Загрузка дашборда…</p>;
  if (err) return <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"><AlertCircle size={14} className="inline mr-1" />{err}</div>;
  if (!data) return null;

  const { funnel, plan_fact } = data;
  // Только реально работающие каналы — для карточек ① и таблицы.
  const activeChannels = plan_fact.filter((c) => c.actual_posts > 0).sort((a, b) => b.actual_leads - a.actual_leads || b.actual_audience - a.actual_audience);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            🔻 Воронка маркетинга · мировой уровень
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Только реальные данные из реестра <code>source_codes</code> + лиды <code>contacts.source_code</code>. Где данных нет — честная пометка.
          </p>
        </div>
        <button onClick={reload} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-white border border-gray-200 rounded hover:bg-gray-50">
          <RefreshCw size={11} />
          Обновить
        </button>
      </div>

      {/* ── ① Карточки инструментов (auto-discovered) ─────────────── */}
      <section>
        <div className="text-[10px] uppercase text-gray-500 font-medium mb-1.5">① Инструменты / посев</div>
        {activeChannels.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded px-4 py-6 text-center text-xs text-gray-500">
            Пока ни один инструмент не записал публикацию в реестр <code>source_codes</code>.
            Когда мозг/посевалка/бот запишет первый пост — карточки появятся автоматически.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {activeChannels.map((ch) => (
              <ChannelCard
                key={ch.key}
                ch={ch}
                expanded={expandedChannel === ch.key}
                onClick={() => setExpandedChannel(expandedChannel === ch.key ? null : ch.key)}
              />
            ))}
          </div>
        )}
        {expandedChannel && (
          <ChannelExpansion channel={expandedChannel} onClose={() => setExpandedChannel(null)} />
        )}
      </section>

      {/* ── ② Графическая воронка ─────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-md p-4">
        <div className="text-[10px] uppercase text-gray-500 font-medium mb-3">② Воронка от посева до курьера</div>
        <FunnelSvg
          reach={funnel.reach}
          views={funnel.views}
          viewsAvailable={funnel.views_available}
          leads={funnel.leads}
          couriers={funnel.couriers ?? funnel.hires}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4 text-xs">
          <KpiCard label="Охват" value={fmt(funnel.reach)} note="Σ audience по реестру" tone="blue" />
          <KpiCard
            label="Реально увидели"
            value={funnel.views_available ? fmt(funnel.views) : 'н/д'}
            note={funnel.views_available
              ? `сумма по площадкам, где доступно`
              : 'органика VK views на чужих стенах не отдаёт'}
            tone="amber"
          />
          <KpiCard
            label="Лиды"
            value={fmt(funnel.leads)}
            note={funnel.cr_lead != null ? `CR охват→лид ${(funnel.cr_lead * 100).toFixed(3)} %` : 'CR измерится после 1-го лида'}
            tone="emerald"
          />
          <KpiCard
            label="🚖 Курьеры"
            value={fmt(funnel.couriers ?? funnel.hires)}
            note={funnel.cr_lead_to_courier != null && (funnel.couriers ?? funnel.hires) > 0
              ? `лид→курьер ${(funnel.cr_lead_to_courier * 100).toFixed(1)} %`
              : (funnel.leads > 0 ? 'лиды есть, курьеров пока нет' : 'появятся после первых лидов')}
            tone="violet"
          />
          <KpiCard
            label={funnel.cpc != null ? 'Цена курьера' : 'Средний CPL'}
            value={funnel.cpc != null
              ? `${fmt(funnel.cpc)} ₽`
              : (funnel.avg_cpl != null ? `${fmt(funnel.avg_cpl)} ₽` : (funnel.cost === 0 ? 'бесплатно' : '—'))}
            note={`всего потрачено: ${fmt(funnel.cost)} ₽`}
            tone="rose"
          />
        </div>
      </section>

      {/* ── ③ Таблица «Эффективность площадок» ─────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-md">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <div className="text-[10px] uppercase text-gray-500 font-medium">③ Эффективность площадок · стоимость лида</div>
          <span className="text-[10px] text-gray-400">отсортировано по CR ↓</span>
        </div>
        {activeChannels.length === 0 ? (
          <p className="text-xs text-gray-400 px-4 py-6 text-center">Площадок ещё нет.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-3 py-1.5">Канал</th>
                <th className="text-right px-2 py-1.5">Постов</th>
                <th className="text-right px-2 py-1.5">Охват</th>
                <th className="text-right px-2 py-1.5">Просмотры</th>
                <th className="text-right px-2 py-1.5" title="Лиды по каналу (по contacts.source)">Лиды</th>
                <th className="text-right px-2 py-1.5" title="из них с точным source_code публикации">из них к посту</th>
                <th className="text-right px-2 py-1.5">CR % (охват→лид)</th>
                <th className="text-right px-2 py-1.5" title="contacts.stage IN (online, retained)">🚖 Курьеры</th>
                <th className="text-right px-2 py-1.5">CR лид→курьер %</th>
                <th className="text-right px-2 py-1.5">Затраты ₽</th>
                <th className="text-right px-3 py-1.5">CPL ₽/лид</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...activeChannels].sort((a, b) => (b.actual_cr ?? -1) - (a.actual_cr ?? -1)).map((c) => (
                <tr key={c.key} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5">
                    <button onClick={() => setExpandedChannel(c.key)} className="text-blue-700 hover:underline text-left">
                      {c.name}
                    </button>
                  </td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{c.actual_posts}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{fmt(c.actual_audience)}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{c.views_seen ? fmt(c.actual_views) : <span className="text-gray-300">н/д</span>}</td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${c.actual_leads > 0 ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>{c.actual_leads || '—'}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums text-gray-500">{(c.actual_leads_attributed ?? 0) > 0 ? c.actual_leads_attributed : '—'}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{c.actual_cr != null ? c.actual_cr.toFixed(3) : '—'}</td>
                  <td className={`text-right px-2 py-1.5 tabular-nums ${(c.actual_couriers ?? 0) > 0 ? 'font-bold text-violet-700' : 'text-gray-400'}`}>{c.actual_couriers || '—'}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{c.cr_to_courier != null ? `${c.cr_to_courier} %` : '—'}</td>
                  <td className="text-right px-2 py-1.5 tabular-nums">{c.actual_cost > 0 ? fmt(c.actual_cost) : <span className="text-gray-300">0 (бесплатно)</span>}</td>
                  <td className={`text-right px-3 py-1.5 tabular-nums ${c.actual_cpl != null ? 'font-bold' : ''}`}>
                    {c.actual_cpl != null ? `${fmt(c.actual_cpl)} ₽` : (c.actual_cost === 0 ? <span className="text-emerald-700">бесплатно</span> : '—')}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50/50 font-bold">
                <td className="px-3 py-1.5">Итого / средний</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{activeChannels.reduce((s, c) => s + c.actual_posts, 0)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmt(funnel.reach)}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{funnel.views_available ? fmt(funnel.views) : 'н/д'}</td>
                <td className="text-right px-2 py-1.5 tabular-nums text-emerald-700">{funnel.leads || '—'}</td>
                <td className="text-right px-2 py-1.5 tabular-nums text-gray-500">{(funnel.leads_attributed ?? 0) > 0 ? funnel.leads_attributed : '—'}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{funnel.cr_lead != null ? (funnel.cr_lead * 100).toFixed(3) : '—'}</td>
                <td className="text-right px-2 py-1.5 tabular-nums text-violet-700">{(funnel.couriers ?? funnel.hires) || '—'}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{funnel.cr_lead_to_courier != null ? `${(funnel.cr_lead_to_courier * 100).toFixed(1)} %` : '—'}</td>
                <td className="text-right px-2 py-1.5 tabular-nums">{fmt(funnel.cost)}</td>
                <td className="text-right px-3 py-1.5 tabular-nums">{funnel.avg_cpl != null ? `${fmt(funnel.avg_cpl)} ₽` : (funnel.cost === 0 ? 'бесплатно' : '—')}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
 * SVG-воронка: 3 трапеции с подписями. Ширина пропорциональна
 * audience → views → leads (с минимальным минимумом).
 * ─────────────────────────────────────────────────────────── */
function FunnelSvg({ reach, views, viewsAvailable, leads, couriers }: { reach: number; views: number; viewsAvailable: boolean; leads: number; couriers: number }) {
  const W = 720, H = 280, GAP = 6, TIER_H = (H - GAP * 3) / 4;
  // Нормируем ширины тиров: каждый ≤ предыдущего, min 12% для видимости.
  const wTop = W;
  const r2 = viewsAvailable && reach > 0 ? Math.max(0.4, Math.min(1, views / reach)) : 0.7;
  const r3 = reach > 0 ? Math.max(0.18, Math.min(1, leads / Math.max(1, reach) * 100)) : 0.22; // лиды сильно меньше — для UI масштабируем
  const r4 = leads > 0 ? Math.max(0.08, Math.min(1, couriers / Math.max(1, leads))) : 0.12;
  const w2 = W * r2;
  const w3 = Math.min(w2, W * r3);
  const w4 = Math.min(w3, w3 * Math.max(0.2, r4));
  const cx = W / 2;

  const tier = (y: number, wBot: number, wTop: number, fill: string, stroke: string) => (
    <polygon
      points={`${cx - wTop / 2},${y} ${cx + wTop / 2},${y} ${cx + wBot / 2},${y + TIER_H} ${cx - wBot / 2},${y + TIER_H}`}
      fill={fill} stroke={stroke} strokeWidth="1"
    />
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
      {/* Tier 1: охват */}
      {tier(0, w2, wTop, '#dbeafe', '#93c5fd')}
      <text x={cx} y={TIER_H / 2 + 4} textAnchor="middle" className="fill-blue-900" style={{ fontSize: 12, fontWeight: 700 }}>
        🌐 Охват · {fmt(reach)}
      </text>

      {/* Tier 2: просмотры */}
      {tier(TIER_H + GAP, w3, w2, '#fef3c7', '#fcd34d')}
      <text x={cx} y={TIER_H + GAP + TIER_H / 2 + 4} textAnchor="middle" className="fill-amber-900" style={{ fontSize: 12, fontWeight: 700 }}>
        👁 Просмотры · {viewsAvailable ? fmt(views) : 'н/д для органики VK'}
      </text>

      {/* Tier 3: лиды */}
      {tier((TIER_H + GAP) * 2, Math.max(80, w4), w3, '#d1fae5', '#6ee7b7')}
      <text x={cx} y={(TIER_H + GAP) * 2 + TIER_H / 2 + 4} textAnchor="middle" className="fill-emerald-900" style={{ fontSize: 12, fontWeight: 700 }}>
        📥 Лиды · {fmt(leads)}
      </text>

      {/* Tier 4: 🚖 Курьеры (на линии: stage online/retained) */}
      {tier((TIER_H + GAP) * 3, Math.max(60, w4 * 0.5), Math.max(80, w4), '#ede9fe', '#a78bfa')}
      <text x={cx} y={(TIER_H + GAP) * 3 + TIER_H / 2 + 4} textAnchor="middle" className="fill-violet-900" style={{ fontSize: 13, fontWeight: 800 }}>
        🚖 Курьеры · {fmt(couriers)}
      </text>
    </svg>
  );
}

function KpiCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'blue' | 'amber' | 'emerald' | 'violet' | 'rose' }) {
  const cls = {
    blue:    'bg-blue-50 border-blue-200 text-blue-900',
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    violet:  'bg-violet-50 border-violet-200 text-violet-900',
    rose:    'bg-rose-50 border-rose-200 text-rose-900',
  }[tone];
  return (
    <div className={`border rounded px-3 py-2 ${cls}`}>
      <div className="text-[10px] uppercase opacity-70">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] opacity-70">{note}</div>
    </div>
  );
}

function ChannelCard({ ch, expanded, onClick }: { ch: PlanFactRow; expanded: boolean; onClick: () => void }) {
  const tone = ch.actual_leads > 0 ? 'border-emerald-300 bg-emerald-50/40'
             : ch.actual_audience > 0 ? 'border-blue-200 bg-blue-50/30'
             : 'border-gray-200 bg-white';
  return (
    <button
      onClick={onClick}
      className={`text-left border rounded-md p-2.5 transition-all hover:shadow-sm ${tone} ${expanded ? 'ring-2 ring-blue-300' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-900 truncate">{ch.name}</span>
        {expanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
      </div>
      <div className="text-[10px] text-gray-500 mb-1.5">
        Сегодня: <strong className="text-gray-900">{ch.today_posts}</strong> · всего: <strong className="text-gray-900">{ch.actual_posts}</strong>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[10px]">
        <Stat tiny label="Охват" value={fmt(ch.actual_audience)} />
        <Stat tiny label="Лиды" value={String(ch.actual_leads)} highlight={ch.actual_leads > 0} />
        <Stat tiny label="CPL" value={ch.actual_cpl != null ? `${ch.actual_cpl} ₽` : (ch.actual_cost === 0 ? '0' : '—')} />
      </div>
      {(ch.actual_deleted > 0 || ch.actual_blocked > 0) && (
        <div className="text-[9px] text-rose-700 mt-1">
          {ch.actual_deleted > 0 && <span>🗑 {ch.actual_deleted} </span>}
          {ch.actual_blocked > 0 && <span>⛔ {ch.actual_blocked}</span>}
        </div>
      )}
    </button>
  );
}

function Stat({ label, value, highlight, tiny }: { label: string; value: string; highlight?: boolean; tiny?: boolean }) {
  return (
    <div className={`bg-white border border-gray-100 rounded px-1 py-0.5 ${tiny ? '' : ''}`}>
      <div className="text-[8px] uppercase text-gray-400">{label}</div>
      <div className={`tabular-nums ${highlight ? 'font-bold text-emerald-700' : 'text-gray-800'}`}>{value}</div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
 * Раскрытие карточки канала: переиспользует /post-history?channel=
 * (ТЗ-073). Показываем список публикаций этого канала.
 * ─────────────────────────────────────────────────────────── */
function ChannelExpansion({ channel, onClose }: { channel: string; onClose: () => void }) {
  const [items, setItems] = useState<PostHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setErr(null);
    safeFetchJson<{ items: PostHistoryItem[] }>(`/api/recruit/post-history?channel=${encodeURIComponent(channel)}`)
      .then((j) => setItems(j.items ?? []))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [channel]);

  return (
    <div className="mt-2 bg-blue-50/40 border border-blue-200 rounded-md">
      <div className="px-3 py-2 border-b border-blue-100 flex items-center justify-between">
        <div className="text-[11px] font-medium text-blue-900">📋 Отчёт инструмента · {channel}</div>
        <button onClick={onClose} className="text-[10px] text-blue-700 hover:underline">Свернуть</button>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400 px-3 py-3">Загрузка…</p>
      ) : err ? (
        <p className="text-xs text-red-700 px-3 py-2">⚠ {err}</p>
      ) : !items || items.length === 0 ? (
        <p className="text-xs text-gray-500 px-3 py-3">По этому каналу публикаций пока нет.</p>
      ) : (
        <table className="w-full text-[11px]">
          <thead className="bg-blue-50/60 text-blue-800">
            <tr>
              <th className="text-left px-3 py-1.5">Когда</th>
              <th className="text-left px-2 py-1.5">Место (placement)</th>
              <th className="text-left px-2 py-1.5">Вариант</th>
              <th className="text-right px-2 py-1.5">Охват</th>
              <th className="text-right px-2 py-1.5">Просм.</th>
              <th className="text-right px-2 py-1.5">Лиды</th>
              <th className="text-right px-2 py-1.5">CR %</th>
              <th className="text-left px-2 py-1.5">Статус</th>
              <th className="text-right px-3 py-1.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {items.slice(0, 50).map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-1 text-gray-600">{new Date(i.placed_at).toLocaleDateString('ru-RU')}</td>
                <td className="px-2 py-1 text-gray-700 truncate max-w-[160px]">{i.placement ?? '—'}</td>
                <td className="px-2 py-1 font-mono text-gray-700">{i.post_ref ?? '—'}</td>
                <td className="px-2 py-1 text-right tabular-nums">{i.audience != null ? fmt(i.audience) : '—'}</td>
                <td className="px-2 py-1 text-right tabular-nums">{i.views != null ? fmt(i.views) : <span className="text-gray-300">—</span>}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${i.leads > 0 ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>{i.leads || '—'}</td>
                <td className="px-2 py-1 text-right tabular-nums">{i.cr != null ? i.cr.toFixed(3) : '—'}</td>
                <td className="px-2 py-1">
                  {i.status === 'live' && <span className="text-[10px] text-emerald-700">✓ live</span>}
                  {i.status === 'deleted' && <span className="text-[10px] text-rose-700">🗑 удалён</span>}
                  {i.status === 'blocked' && <span className="text-[10px] text-rose-700">⛔ блок</span>}
                </td>
                <td className="px-3 py-1 text-right">
                  {i.post_url ? (
                    <a href={i.post_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-0.5">
                      пост <ExternalLink size={9} />
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length > 50 && (
              <tr><td colSpan={9} className="text-center text-[10px] text-gray-500 px-3 py-1">… показаны первые 50 из {items.length}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
