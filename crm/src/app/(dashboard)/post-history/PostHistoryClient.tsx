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
  leads: number;
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
        <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-md">
          <div className="text-2xl font-bold text-emerald-700">{totalLeads}</div>
          <div className="text-[11px] text-emerald-600 uppercase tracking-wide">лидов всего</div>
        </div>
      </div>

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
                <th className="px-3 py-2">Код</th>
                <th className="px-3 py-2 text-center">Лиды</th>
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
                      <span className="font-medium">{it.placement ?? '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {it.post_ref ?? '—'}
                    {it.segment && <span className="ml-1 text-[10px] px-1 rounded bg-gray-100 text-gray-500 border border-gray-200">{it.segment}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px] text-gray-500">{it.code ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block min-w-[24px] px-1.5 py-0.5 rounded text-[12px] font-semibold ${it.leads > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      {it.leads}
                    </span>
                  </td>
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
