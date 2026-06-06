'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Flame, Search, RefreshCw, ExternalLink, Copy, MessageSquare,
  Check, AlertCircle,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { fmtMsk } from '@/lib/tz';

interface Row {
  id: string;
  created_at: string;
  config: Record<string, unknown> | null;
}

interface Resp {
  items: Row[];
  summary: Record<string, number>;
  pageInfo: { page: number; per: number; pages: number; total: number };
}

interface Props { tenantName: string | null }

const BOT_USERNAME = 'stolica_dostavka_zbium_bot';
const STATUSES: Array<{ v: string; label: string; color: string }> = [
  { v: 'new',       label: '🆕 Новые',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { v: 'contacted', label: '📤 Написал',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { v: 'replied',   label: '💬 Ответил',    color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { v: 'in_bot',    label: '🤖 Пошёл в бота', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { v: 'joined',    label: '🏁 На линии',   color: 'bg-green-200 text-green-900 border-green-300' },
  { v: 'rejected',  label: '❌ Отказ',      color: 'bg-red-50 text-red-600 border-red-200' },
];

function buildOpener(name: string | null, seekerId: string): string {
  const n = (name && name.trim()) ? name.trim() : 'привет';
  return `Привет, ${n}! Увидел в чате, что ищешь работу — актуально ещё?
Подбираю ребят в доставку (курьером — пешком/вело/авто), работа в день обращения, выплаты тоже в первый день. Если интересно или хочешь просто посмотреть варианты — напиши боту: t.me/${BOT_USERNAME}?start=seeker_${seekerId.slice(0, 8)}. Там за пару минут подберём, что тебе подходит 👇`;
}

export default function JobSeekersClient({ tenantName }: Props) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [hotOnly, setHotOnly] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const sp = new URLSearchParams();
      if (statusFilter) sp.set('status', statusFilter);
      if (hotOnly) sp.set('hot', 'yes');
      if (q.trim()) sp.set('q', q.trim());
      sp.set('page', String(page));
      const j = await safeFetchJson<Resp>(`/api/recruit/job-seekers?${sp.toString()}`);
      setResp(j); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter, hotOnly, q, page]);
  useEffect(() => { reload(); }, [reload]);

  const items = resp?.items ?? [];
  const summary = resp?.summary ?? { total: 0, hot: 0, new: 0, contacted: 0, in_bot: 0, joined: 0 };

  async function patchSeeker(id: string, patch: Record<string, unknown>) {
    try {
      await safeFetchJson(`/api/recruit/job-seekers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await reload(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Flame size={20} className="text-orange-500" />
            🔥 Соискатели{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Люди, которые САМИ пишут «ищу работу» в чатах. Парсер ловит, ты пишешь мягко с личного аккаунта и ведёшь в бота.
          </p>
        </div>
        <button onClick={() => reload()} disabled={refreshing} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {/* ── Фильтры + сводка ─────────────────────────────────── */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-2 flex-wrap">
        <button onClick={() => { setStatusFilter(''); setHotOnly(false); setPage(1); }}
          className={`px-2.5 py-1 text-xs rounded ${!statusFilter && !hotOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          Все · {summary.total}
        </button>
        <button onClick={() => { setHotOnly(true); setStatusFilter(''); setPage(1); }}
          className={`px-2.5 py-1 text-xs rounded ${hotOnly ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
          ⚡ Горячие · {summary.hot}
        </button>
        {STATUSES.map((s) => (
          <button key={s.v} onClick={() => { setStatusFilter(s.v); setHotOnly(false); setPage(1); }}
            className={`px-2.5 py-1 text-xs rounded border ${statusFilter === s.v ? 'bg-blue-600 text-white border-blue-700' : `${s.color} hover:opacity-80`}`}>
            {s.label} · {summary[s.v] ?? 0}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative w-64">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Поиск по username / имени / тексту…"
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none" />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Список карточек ──────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Flame size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Пока никого не нашли. Парсер собирает входящих по мере поступления — обнови позже.</p>
          </div>
        ) : (
          items.map((r) => (
            <SeekerCard key={r.id} row={r} onPatch={(patch) => patchSeeker(r.id, patch)} />
          ))
        )}
      </div>

      {/* ── Пагинация ──────────────────────────────────────── */}
      {resp && resp.pageInfo.pages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-t border-gray-200">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={resp.pageInfo.page <= 1}
            className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30">← пред.</button>
          <span className="text-xs text-gray-700">стр. {resp.pageInfo.page} из {resp.pageInfo.pages}</span>
          <button onClick={() => setPage((p) => Math.min(resp.pageInfo.pages, p + 1))} disabled={resp.pageInfo.page >= resp.pageInfo.pages}
            className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30">след. →</button>
        </div>
      )}
    </div>
  );
}

function SeekerCard({ row, onPatch }: { row: Row; onPatch: (patch: Record<string, unknown>) => Promise<void> | void }) {
  const c = (row.config ?? {}) as Record<string, unknown>;
  const username = (c.username as string) ?? '';
  const name = (c.name as string) ?? null;
  const link = `https://t.me/${String(username).replace(/^@/, '')}`;
  const fromGroup = (c.from_group_name as string) ?? (c.from_group as string) ?? '';
  const city = (c.city as string) ?? '';
  const text = (c.text as string) ?? '';
  const original = (c.original as string) ?? '';
  const status = (c.human_status as string) ?? 'new';
  const note = (c.note as string) ?? '';
  const isHot = c.extra_hot === true;
  const msgTs = typeof c.msg_ts === 'number' ? c.msg_ts : null;
  const when = msgTs ? new Date(msgTs * 1000).toISOString() : row.created_at;

  const [opener, setOpener] = useState(buildOpener(name, row.id));

  function copyOpener() {
    navigator.clipboard?.writeText(opener);
  }

  function openTg() {
    if (!username) return;
    window.open(link, '_blank', 'noopener');
    if (status === 'new') onPatch({ human_status: 'contacted', contacted: true });
  }

  const statusMeta = STATUSES.find((s) => s.v === status) ?? STATUSES[0];

  return (
    <div className={`bg-white border rounded-md p-3 ${isHot ? 'border-orange-300 ring-2 ring-orange-100' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isHot && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 font-bold">
                ⚡ ГОРЯЧИЙ
              </span>
            )}
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
              @{String(username).replace(/^@/, '')}
              <ExternalLink size={10} />
            </a>
            {name && <span className="text-sm text-gray-700">· {name}</span>}
            {city && <span className="text-xs text-gray-500">· 📍 {city}</span>}
          </div>
          {fromGroup && (
            <div className="text-[10px] text-gray-500 mt-0.5">в чате: <span className="font-medium">{fromGroup}</span></div>
          )}
        </div>
        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${statusMeta.color}`}>
          {statusMeta.label}
        </span>
      </div>

      {(text || original) && (
        <div className="text-xs text-gray-900 bg-amber-50/50 border border-amber-200 rounded px-2.5 py-2 leading-snug mb-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
          <strong className="text-amber-800">«</strong>{text || original}<strong className="text-amber-800">»</strong>
        </div>
      )}

      {/* Опенер */}
      <details className="mb-2 group">
        <summary className="cursor-pointer text-[11px] font-medium text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 list-none">
          <MessageSquare size={11} />
          📋 Готовый тёплый опенер
        </summary>
        <div className="mt-1.5 space-y-1.5">
          <textarea value={opener} onChange={(e) => setOpener(e.target.value)} rows={5}
            className="w-full px-2 py-1.5 text-[11px] border border-emerald-200 bg-emerald-50/40 rounded focus:border-emerald-400 focus:outline-none resize-y" />
          <div className="flex items-center gap-2">
            <button onClick={copyOpener} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-white border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">
              <Copy size={11} /> Копировать
            </button>
            <button onClick={openTg} disabled={!username}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40">
              <ExternalLink size={11} /> Написать мягко в Telegram
            </button>
          </div>
        </div>
      </details>

      {/* Контролы */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
        <select value={status} onChange={(e) => onPatch({ human_status: e.target.value })}
          className="px-2 py-1 text-[11px] border border-gray-200 rounded">
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-700">
          <input type="checkbox" checked={!!c.contacted} onChange={(e) => onPatch({ contacted: e.target.checked })} />
          Контакт установлен
        </label>
        <input value={note} onChange={(e) => onPatch({ note: e.target.value })} placeholder="Заметка…"
          className="px-2 py-1 text-[11px] border border-gray-200 rounded col-span-1 md:col-span-1" />
      </div>

      <div className="text-[9px] text-gray-400 mt-2 flex items-center justify-between">
        <span>{when ? fmtMsk(when, true) : ''} МСК</span>
        {c.contacted ? <span className="text-emerald-700 inline-flex items-center gap-0.5"><Check size={9} /> контакт</span> : null}
      </div>
    </div>
  );
}
