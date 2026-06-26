'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, Megaphone, Users, Send } from 'lucide-react';

interface Item {
  id: string;
  code: string | null;
  channel: string | null;
  placement: string | null;
  post_ref: string | null;
  segment: string | null;
  placed_at: string;
  post_url: string | null;
  bot_link: string | null;
  audience: number | null;
  leads: number;
  cr: number | null;
  views: number | null;
  comments: number | null;
  likes: number | null;
  reposts: number | null;
  above: number | null;
  hour_msk: number | null;
  status: string;
  deleted_at: string | null;
}

interface HourStat {
  hour: number;
  posts: number;
  leads: number;
  audience: number;
  views: number;
  cr: number | null;
}

function fmt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function PostHistoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalAudience, setTotalAudience] = useState(0);
  const [totalDeleted, setTotalDeleted] = useState(0);
  const [totalBlocked, setTotalBlocked] = useState(0);
  const [byHour, setByHour] = useState<HourStat[]>([]);
  const [byVariant, setByVariant] = useState<{ variant: string; posts: number; leads: number; audience: number; comments: number; cr: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/recruit/post-history', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'load failed');
      setItems(j.items ?? []);
      setTotalLeads(j.total_leads ?? 0);
      setTotalAudience(j.total_audience ?? 0);
      setTotalDeleted(j.total_deleted ?? 0);
      setTotalBlocked(j.total_blocked ?? 0);
      setByHour(j.byHour ?? []);
      setByVariant(j.byVariant ?? []);
    } catch (e) {
      setError(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Megaphone size={20} /> История постинга
        </h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Каждая публикация (посев) с кодом атрибуции — где, когда, какой пост, ссылка и сколько лидов пришло.
      </p>

      <div className="flex gap-3 mb-4">
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-2xl font-bold text-blue-700">{items.length}</div>
          <div className="text-[11px] text-blue-600 uppercase tracking-wide">публикаций</div>
        </div>
        <div className="px-4 py-2 bg-violet-50 border border-violet-200 rounded-md">
          <div className="text-2xl font-bold text-violet-700">{totalAudience.toLocaleString('ru-RU')}</div>
          <div className="text-[11px] text-violet-600 uppercase tracking-wide">охват (участники)</div>
        </div>
        <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-md">
          <div className="text-2xl font-bold text-emerald-700">{totalLeads}</div>
          <div className="text-[11px] text-emerald-600 uppercase tracking-wide">лидов всего</div>
        </div>
        <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-md">
          <div className="text-2xl font-bold text-amber-700">{totalAudience > 0 ? (Math.round((totalLeads / totalAudience) * 100000) / 1000) : 0}%</div>
          <div className="text-[11px] text-amber-600 uppercase tracking-wide">конверсия охват→лид</div>
        </div>
        <div className={`px-4 py-2 rounded-md border ${(totalDeleted + totalBlocked) > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`text-2xl font-bold ${(totalDeleted + totalBlocked) > 0 ? 'text-red-700' : 'text-gray-400'}`}>{totalDeleted}{totalBlocked > 0 ? `+${totalBlocked}` : ''}</div>
          <div className="text-[11px] uppercase tracking-wide text-red-600">удалено / 🚫 блок</div>
        </div>
      </div>

      {/* ── A/B: сравнение вариантов поста ── */}
      {byVariant.length > 1 && (
        <div className="mb-5 border border-gray-200 rounded-md p-3">
          <span className="text-sm font-medium flex items-center gap-1.5 mb-2">🆚 A/B по вариантам</span>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] text-gray-500 uppercase">
                <th className="py-1 pr-3">Вариант</th><th className="py-1 px-2 text-center">Постов</th>
                <th className="py-1 px-2 text-center">Охват</th><th className="py-1 px-2 text-center">Лиды</th>
                <th className="py-1 px-2 text-center">Комм.</th><th className="py-1 px-2 text-center">CR%</th>
              </tr></thead>
              <tbody>
                {byVariant.map((v, idx) => (
                  <tr key={v.variant} className={`border-t border-gray-100 ${idx === 0 && v.leads > 0 ? 'bg-emerald-50' : ''}`}>
                    <td className="py-1.5 pr-3 font-medium">{idx === 0 && v.leads > 0 && '🏆 '}{v.variant}</td>
                    <td className="py-1.5 px-2 text-center text-gray-600">{v.posts}</td>
                    <td className="py-1.5 px-2 text-center text-gray-600">{v.audience.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 px-2 text-center font-semibold text-emerald-700">{v.leads}</td>
                    <td className="py-1.5 px-2 text-center text-gray-600">{v.comments}</td>
                    <td className="py-1.5 px-2 text-center font-semibold">{v.cr != null ? `${v.cr}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Победитель — выше CR% при накопленном охвате. 🏆 = лидер по лидам/CR.</p>
        </div>
      )}

      {/* ── Прайм-тайм: лиды/CR по часу публикации (МСК) ── */}
      {byHour.length > 0 && (() => {
        const maxLeads = Math.max(1, ...byHour.map((h) => h.leads));
        const best = byHour.filter((h) => h.leads > 0).sort((a, b) => (b.cr ?? 0) - (a.cr ?? 0))[0];
        return (
          <div className="mb-5 border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1.5">🕐 Прайм-тайм (по часу публикации, МСК)</span>
              {best && <span className="text-[11px] text-emerald-700">Лучший час: <b>{String(best.hour).padStart(2,'0')}:00</b> · CR {best.cr}%</span>}
            </div>
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 24 }, (_, h) => {
                const s = byHour.find((x) => x.hour === h);
                const leads = s?.leads ?? 0;
                const hPct = Math.round((leads / maxLeads) * 100);
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end" title={s ? `${String(h).padStart(2,'0')}:00 — постов ${s.posts}, лидов ${leads}, CR ${s.cr ?? 0}%` : `${String(h).padStart(2,'0')}:00 — нет постов`}>
                    <div className={`w-full rounded-t ${leads > 0 ? 'bg-emerald-500' : (s ? 'bg-gray-200' : 'bg-gray-100')}`} style={{ height: `${Math.max(leads > 0 ? 8 : 2, hPct)}%` }} />
                    <span className="text-[8px] text-gray-400 mt-0.5">{h % 3 === 0 ? h : ''}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Высота столбца = лиды по этому часу. Данные копятся с постами — чем больше засеяно, тем точнее видно прайм-тайм.</p>
          </div>
        );
      })()}

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-md">
          Публикаций пока нет. Они появятся здесь автоматически после первого постинга.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-[11px] text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2">Где</th>
                <th className="px-3 py-2">Пост</th>
                <th className="px-3 py-2 text-center">Охват</th>
                <th className="px-3 py-2 text-center" title="Сколько постов уже выше нашего (насколько утонул)">⬆ Сверху</th>
                <th className="px-3 py-2 text-center">👁 Просм.</th>
                <th className="px-3 py-2 text-center">💬 Комм.</th>
                <th className="px-3 py-2 text-center">Лиды</th>
                <th className="px-3 py-2 text-center">CR%</th>
                <th className="px-3 py-2">Ссылки</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmt(it.placed_at)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {it.channel === 'vk' ? <Users size={13} className="text-blue-600" /> : <Send size={13} className="text-sky-500" />}
                      <span className={`font-medium ${it.status !== 'live' ? 'line-through text-gray-400' : ''}`}>{it.placement ?? '—'}</span>
                      {it.status === 'deleted' && <span className="text-[10px] px-1 rounded bg-red-100 text-red-700 border border-red-200" title={it.deleted_at ? `замечено ${it.deleted_at}` : ''}>🗑 удалён</span>}
                      {it.status === 'blocked' && <span className="text-[10px] px-1 rounded bg-red-100 text-red-700 border border-red-200">🚫 блок</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {it.post_ref ?? '—'}
                    {it.segment && <span className="ml-1 text-[10px] px-1 rounded bg-gray-100 text-gray-500 border border-gray-200">{it.segment}</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">{it.audience != null ? it.audience.toLocaleString('ru-RU') : '—'}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{it.above != null ? (it.above >= 300 ? '300+' : it.above) : '—'}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{it.views != null ? it.views.toLocaleString('ru-RU') : '—'}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{it.comments != null ? it.comments : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block min-w-[24px] px-1.5 py-0.5 rounded text-[12px] font-semibold ${it.leads > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      {it.leads}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px] text-gray-600">{it.cr != null ? `${it.cr}%` : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {it.post_url && (
                        <a href={it.post_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[12px]">
                          <ExternalLink size={12} /> пост
                        </a>
                      )}
                      {it.bot_link && (
                        <a href={it.bot_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 text-[12px]">
                          <ExternalLink size={12} /> ссылка лида
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
