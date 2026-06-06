'use client';

import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { VkRow } from './page';

const MODES: Record<string, { label: string; cls: string }> = {
  open: { label: '🟢 открытая стена', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  suggest: { label: '✍️ предложка', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  comments: { label: '💬 комменты', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  ads: { label: '📢 VK Ads', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  closed: { label: '🔒 закрыто', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};
const PER_PAGE = 50;

interface G { id: string; name: string; members: number; mode: string; city: string; link: string; query: string }

function norm(rows: VkRow[]): G[] {
  return rows.map((r) => {
    const c = (r.config ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      name: String(r.name ?? c.name ?? '—'),
      members: Number(c.members) || 0,
      mode: String(c.post_mode ?? ''),
      city: String(c.city ?? ''),
      link: String(c.link ?? (c.screen_name ? `https://vk.com/${c.screen_name}` : '')),
      query: String(c.found_query ?? ''),
    };
  });
}

export default function VkGroupsClient({ initialGroups }: { initialGroups: VkRow[] }) {
  const all = useMemo(() => norm(initialGroups), [initialGroups]);
  const [mode, setMode] = useState<string>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of all) m[g.mode] = (m[g.mode] || 0) + 1;
    return m;
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((g) => (mode ? g.mode === mode : true))
      .filter((g) => (needle ? (g.name.toLowerCase().includes(needle) || g.city.toLowerCase().includes(needle)) : true))
      .sort((a, b) => b.members - a.members);
  }, [all, mode, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  const chip = (v: string, label: string) => (
    <button
      onClick={() => { setMode(v); setPage(1); }}
      className={`px-2.5 py-1 text-xs rounded border ${mode === v ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 max-w-6xl">
      <h1 className="text-[15px] font-medium text-gray-900 mb-0.5">VK группы · каталог сообществ</h1>
      <p className="text-[12px] text-gray-500 mb-3">
        Разведка аудитории ВКонтакте. VK не даёт постить на чужие стены — смотри колонку «как достучаться».
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {chip('', `Все · ${all.length}`)}
        {chip('open', `🟢 открытые · ${counts.open ?? 0}`)}
        {chip('suggest', `✍️ предложка · ${counts.suggest ?? 0}`)}
        {chip('comments', `💬 комменты · ${counts.comments ?? 0}`)}
        {chip('ads', `📢 ads · ${counts.ads ?? 0}`)}
        {chip('closed', `🔒 закрыто · ${counts.closed ?? 0}`)}
      </div>

      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1); }}
        placeholder="Поиск по названию / городу…"
        className="w-full max-w-md px-2.5 py-1.5 text-xs border border-gray-200 rounded mb-3"
      />

      <div className="text-[11px] text-gray-500 mb-1">Найдено: {filtered.length}</div>
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left font-medium px-2 py-1.5">Сообщество</th>
              <th className="text-right font-medium px-2 py-1.5">Участники</th>
              <th className="text-left font-medium px-2 py-1.5">Как достучаться</th>
              <th className="text-left font-medium px-2 py-1.5">Город</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((g) => {
              const m = MODES[g.mode] ?? { label: g.mode || '—', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
              return (
                <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    {g.link ? (
                      <a href={g.link} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline inline-flex items-center gap-1">
                        {g.name} <ExternalLink size={10} />
                      </a>
                    ) : g.name}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{g.members.toLocaleString('ru-RU')}</td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded border ${m.cls}`}>{m.label}</span>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">{g.city}</td>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-400">
                Пусто. VK-группы собирает парсер (automation/parser/vk_groups_parser.py).
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={cur <= 1}
            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">← пред.</button>
          <span>{cur} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={cur >= pages}
            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30">след. →</button>
        </div>
      )}
    </div>
  );
}
