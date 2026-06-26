'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Flame, Search, RefreshCw, ExternalLink, Copy, MessageSquare,
  Check, AlertCircle, Plus, X, Pencil, Trash2, Save,
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

const BOT_USERNAME = 'stolica_dostavka_bot';
const STATUSES: Array<{ v: string; label: string; color: string }> = [
  { v: 'new',       label: '🆕 Новые',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { v: 'contacted', label: '📤 Написал',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { v: 'replied',   label: '💬 Ответил',    color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { v: 'in_bot',    label: '🤖 Пошёл в бота', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { v: 'joined',    label: '🏁 На линии',   color: 'bg-green-200 text-green-900 border-green-300' },
  { v: 'rejected',  label: '❌ Отказ',      color: 'bg-red-50 text-red-600 border-red-200' },
];

// ТЗ-068.B: сегменты опенера, у каждого свой ключ в config.variants.
export type SeekerSegment = 'A' | 'B' | 'C';
const SEGMENTS: Array<{ v: SeekerSegment; label: string; key: string }> = [
  { v: 'A', label: 'A · Приезжий', key: 'A_Приезжий' },
  { v: 'B', label: 'B · Местный',  key: 'B_Местный' },
  { v: 'C', label: 'C · Новичок',  key: 'C_Новичок' },
];

interface OpenerCfg {
  variants?: Record<string, string>;
  default?: string | null;
  note?: string | null;
  two_step?: string | boolean | null;
}

/** ТЗ-068.B: текст из CRM (config.variants[<segment>] | default) с подстановкой
 *  {Имя}, {Город}, fallback на «привет» при пустых данных. seekerId оставлен
 *  чтобы старая ссылка ?start=seeker_<id> работала; реальная CRM-версия
 *  обычно содержит уже свою CTA-ссылку. */
function buildOpener(opener: OpenerCfg | null, segment: SeekerSegment, name: string | null, city: string | null, seekerId: string): string {
  const segKey = SEGMENTS.find((s) => s.v === segment)?.key;
  const raw = (segKey && opener?.variants?.[segKey])
    || opener?.default
    || `Привет, {Имя}! Увидел в чате, что ищешь работу — актуально ещё?\nПодбираю ребят в доставку (курьером — пешком/вело/авто), работа в день обращения, выплаты тоже в первый день. Если интересно — напиши боту: t.me/${BOT_USERNAME}?start=seeker_${seekerId.slice(0, 8)}. Там за пару минут подберём, что тебе подходит 👇`;
  const safeName = (name && name.trim()) ? name.trim() : 'привет';
  const safeCity = (city && city.trim()) ? city.trim() : 'Москва';
  return raw
    .replace(/\{Имя\}/g, safeName)
    .replace(/\{Город\}/g, safeCity)
    .replace(/\{ИмяБота\}/g, BOT_USERNAME)
    .replace(/\{СоискательID\}/g, seekerId.slice(0, 8));
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
  const [adding, setAdding] = useState(false);
  // ТЗ-068.B: опенеры из CRM (channels kind='seeker_opener'), один раз на маунт.
  const [opener, setOpener] = useState<OpenerCfg | null>(null);

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

  // ТЗ-068.B: опенеры из CRM — грузим один раз, не блокируя список.
  useEffect(() => {
    (async () => {
      try {
        const r = await safeFetchJson<{ opener: OpenerCfg | null }>('/api/recruit/seeker-opener');
        if (r.opener) setOpener(r.opener);
      } catch {
        // не критично — будет fallback внутри buildOpener
      }
    })();
  }, []);

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
  async function deleteSeeker(id: string) {
    if (!confirm('Удалить соискателя? Восстановить нельзя — только если парсер найдёт заново.')) return;
    try {
      await safeFetchJson(`/api/recruit/job-seekers/${id}`, { method: 'DELETE' });
      await reload(true);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
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
        <div className="flex items-center gap-2">
          <button onClick={() => reload()} disabled={refreshing} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Обновить
          </button>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700">
            <Plus size={12} />
            Добавить соискателя
          </button>
        </div>
      </header>

      {adding && <SeekerFormModal mode="create" onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await reload(true); }} />}

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
            <SeekerCard key={r.id} row={r}
              opener={opener}
              onPatch={(patch) => patchSeeker(r.id, patch)}
              onDelete={() => deleteSeeker(r.id)}
              onSaved={() => reload(true)} />
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

function SeekerCard({ row, opener, onPatch, onDelete, onSaved }: { row: Row; opener: OpenerCfg | null; onPatch: (patch: Record<string, unknown>) => Promise<void> | void; onDelete: () => void; onSaved: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const c = (row.config ?? {}) as Record<string, unknown>;
  const username = (c.username as string) ?? '';
  const name = (c.name as string) ?? null;
  const link = `https://t.me/${String(username).replace(/^@/, '')}`;
  const fromGroup = (c.from_group_name as string) ?? (c.from_group as string) ?? '';
  const postLink = (c.post_link as string) || (c.from_group ? `https://t.me/${String(c.from_group).replace(/^@/, '')}` : '');
  const hasExactPost = Boolean(c.post_link);
  const city = (c.city as string) ?? '';
  const text = (c.text as string) ?? '';
  const original = (c.original as string) ?? '';
  const status = (c.human_status as string) ?? 'new';
  const note = (c.note as string) ?? '';
  const isHot = c.extra_hot === true;
  const msgTs = typeof c.msg_ts === 'number' ? c.msg_ts : null;
  const when = msgTs ? new Date(msgTs * 1000).toISOString() : row.created_at;

  const [segment, setSegment] = useState<SeekerSegment>('A');
  const [openerText, setOpenerText] = useState<string>(() => buildOpener(opener, 'A', name, city, row.id));
  // Если opener-config пришёл позже маунта или сменился сегмент — обновляем текст,
  // только если пользователь его сам не редактировал (т.е. он совпадает с пред. сгенерённым).
  const [lastGenerated, setLastGenerated] = useState<string>(openerText);
  useEffect(() => {
    const next = buildOpener(opener, segment, name, city, row.id);
    setOpenerText((prev) => (prev === lastGenerated || !prev.trim() ? next : prev));
    setLastGenerated(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opener, segment, name, city, row.id]);

  function copyOpener() {
    navigator.clipboard?.writeText(openerText);
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
            <div className="text-[10px] text-gray-500 mt-0.5">
              в чате:{' '}
              {postLink ? (
                <a href={postLink} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5">
                  {fromGroup} <ExternalLink size={9} />
                </a>
              ) : (
                <span className="font-medium">{fromGroup}</span>
              )}
              {hasExactPost && <span className="text-gray-400"> · ↗ открыть пост</span>}
            </div>
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
          {/* ТЗ-068.B: переключатель сегмента A/B/C — варианты из CRM seeker_opener.variants */}
          <div className="flex items-center gap-1 text-[10px]">
            {SEGMENTS.map((s) => {
              const has = !!(opener?.variants && opener.variants[s.key]);
              const active = segment === s.v;
              return (
                <button
                  key={s.v}
                  onClick={() => setSegment(s.v)}
                  title={has ? `Вариант из CRM: ${s.key}` : 'В CRM нет — будет fallback (default)'}
                  className={`px-1.5 py-0.5 rounded border ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : has
                        ? 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
            {opener && (
              <span className="ml-auto text-emerald-700/70">из CRM seeker_opener</span>
            )}
          </div>
          <textarea value={openerText} onChange={(e) => setOpenerText(e.target.value)} rows={5}
            className="w-full px-2 py-1.5 text-[11px] border border-emerald-200 bg-emerald-50/40 rounded focus:border-emerald-400 focus:outline-none resize-y" />
          <div className="flex items-center gap-2">
            <button onClick={copyOpener} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-white border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">
              <Copy size={11} /> 📋 Копировать
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
        <div className="flex items-center gap-2">
          {c.contacted ? <span className="text-emerald-700 inline-flex items-center gap-0.5"><Check size={9} /> контакт</span> : null}
          <button onClick={() => setEditing(true)} title="Редактировать все поля"
            className="text-blue-600 hover:bg-blue-50 rounded p-0.5"><Pencil size={10} /></button>
          <button onClick={onDelete} title="Удалить"
            className="text-red-500 hover:bg-red-50 rounded p-0.5"><Trash2 size={10} /></button>
        </div>
      </div>
      {editing && (
        <SeekerFormModal mode="edit" initial={row}
          onClose={() => setEditing(false)}
          onSaved={async () => { setEditing(false); await onSaved(); }} />
      )}
    </div>
  );
}

/* ─── Модалка добавления/редактирования соискателя ──────────────── */
function SeekerFormModal({
  mode, initial, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: Row;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const c = ((initial?.config ?? {}) as Record<string, unknown>);
  const [username, setUsername] = useState(String(c.username ?? ''));
  const [name, setName] = useState(String(c.name ?? ''));
  const [city, setCity] = useState(String(c.city ?? ''));
  const [text, setText] = useState(String(c.text ?? ''));
  const [original, setOriginal] = useState(String(c.original ?? ''));
  const [fromGroup, setFromGroup] = useState(String(c.from_group ?? ''));
  const [fromGroupName, setFromGroupName] = useState(String(c.from_group_name ?? ''));
  const [extraHot, setExtraHot] = useState<boolean>(c.extra_hot === true);
  const [contacted, setContacted] = useState<boolean>(c.contacted === true);
  const [humanStatus, setHumanStatus] = useState<string>(String(c.human_status ?? 'new'));
  const [note, setNote] = useState(String(c.note ?? ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const body = {
        username: username.trim() || null,
        name: name.trim() || null,
        city: city.trim() || null,
        text: text.trim() || null,
        original: original.trim() || null,
        from_group: fromGroup.trim() || null,
        from_group_name: fromGroupName.trim() || null,
        extra_hot: extraHot,
        contacted,
        human_status: humanStatus,
        note: note.trim() || null,
      };
      const url = mode === 'create' ? '/api/recruit/job-seekers' : `/api/recruit/job-seekers/${initial!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      await safeFetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-900">
            {mode === 'create' ? '➕ Добавить соискателя' : '✏️ Редактировать соискателя'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>
        <div className="px-4 py-3 space-y-2.5">
          {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <SeekerField label="Telegram username (без @)">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ivan_petrov"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
            </SeekerField>
            <SeekerField label="Имя">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иван"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
            </SeekerField>
          </div>
          <SeekerField label="Город">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва / Бишкек / …"
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
          </SeekerField>
          <SeekerField label="Что написал (text)">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder="ищу работу 18 лет курьер" className="w-full px-2 py-1 text-xs border border-gray-200 rounded resize-y" />
          </SeekerField>
          <SeekerField label="Оригинал запроса (полный текст)">
            <textarea value={original} onChange={(e) => setOriginal(e.target.value)} rows={4}
              placeholder="Полное сообщение из чата (опционально)" className="w-full px-2 py-1 text-xs border border-gray-200 rounded resize-y" />
          </SeekerField>
          <div className="grid grid-cols-2 gap-2">
            <SeekerField label="Чат-источник (username)">
              <input value={fromGroup} onChange={(e) => setFromGroup(e.target.value)} placeholder="@chat_xyz"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
            </SeekerField>
            <SeekerField label="Чат-источник (название)">
              <input value={fromGroupName} onChange={(e) => setFromGroupName(e.target.value)} placeholder="Работа Москва"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
            </SeekerField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SeekerField label="Статус">
              <select value={humanStatus} onChange={(e) => setHumanStatus(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded">
                {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </SeekerField>
            <div className="flex items-end gap-3 pb-1">
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={extraHot} onChange={(e) => setExtraHot(e.target.checked)} />
                ⚡ горячий
              </label>
              <label className="text-xs flex items-center gap-1">
                <input type="checkbox" checked={contacted} onChange={(e) => setContacted(e.target.checked)} />
                контакт
              </label>
            </div>
          </div>
          <SeekerField label="Заметка">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="свои мысли"
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
          </SeekerField>
        </div>
        <footer className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2 sticky bottom-0">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded">Отмена</button>
          <button onClick={submit} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-40">
            <Save size={12} /> {busy ? 'Сохранение…' : (mode === 'create' ? 'Создать' : 'Сохранить')}
          </button>
        </footer>
      </div>
    </div>
  );
}

function SeekerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-0.5">{label}</label>
      {children}
    </div>
  );
}
