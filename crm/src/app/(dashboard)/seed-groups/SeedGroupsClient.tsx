'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';

/**
 * /seed-groups — ТЗ-064: Сергей сам отмечает группы готовые к засеву,
 * пишет механику постинга, прикрепляет одобренный текст; добавляет
 * новые группы списком @username.
 *
 * Источник данных: /api/recruit/parser-channels (расширен ТЗ-064 полями
 * seed_ready/human_joined/human_verified/manual_mechanics/manual_desc/
 * assigned_text/human_status). Парсер уважает human_locked + ENRICH_KEYS,
 * правки переживают пересинк.
 */

type FilterMode = 'ready' | 'candidate' | 'all';

interface Row {
  id: string;
  name: string | null;
  username: string | null;
  link: string | null;
  members: number | null;
  country: string | null;
  city: string | null;
  is_group: boolean;
  status: string | null;
  can_post: boolean | null;
  post_via: string | null;
  ad_contact: string | null;
  post_mode: string | null;
  about: string | null;
  joined: boolean | null;
  source: string | null;
  // ТЗ-064
  seed_ready: boolean | null;
  human_joined: boolean | null;
  human_verified: boolean | null;
  manual_mechanics: string | null;
  manual_desc: string | null;
  assigned_text: string | null;
  human_status: string | null;
}

interface ListResp {
  items: Row[];
  summary: {
    total: number;
    seed_ready: number;
    human_joined: number;
    joined: number;
    postable: number;
  };
  page: { page: number; per: number; total: number; pages: number };
}

interface TextOption {
  id: string;
  label: string;
  campaign: string | null;
}

const HUMAN_STATUSES: { v: string; label: string }[] = [
  { v: '', label: '—' },
  { v: 'ready', label: '✅ готова' },
  { v: 'paid', label: '💸 платное' },
  { v: 'admin', label: '👮 только админ' },
  { v: 'rejected', label: '❌ отказали' },
  { v: 'testing', label: '🧪 тест' },
];

export default function SeedGroupsClient() {
  const [mode, setMode] = useState<FilterMode>('ready');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(50);
  const [data, setData] = useState<ListResp | null>(null);
  const [textOptions, setTextOptions] = useState<TextOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [addText, setAddText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (mode === 'ready') params.set('seed_ready', 'yes');
      else if (mode === 'candidate') params.set('seed_ready', 'candidate');
      if (q.trim()) params.set('q', q.trim());
      params.set('page', String(page));
      params.set('per', String(per));
      params.set('sort', 'members');
      params.set('dir', 'desc');
      const resp = await safeFetchJson<ListResp>(`/api/recruit/parser-channels?${params.toString()}`);
      setData(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, q, page, per]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Список одобренных текстов — для select assigned_text.
  useEffect(() => {
    (async () => {
      try {
        const r = await safeFetchJson<{ groups: { campaigns: { id: string; name: string | null; variants?: { id: string; label: string | null; status: string | null }[] }[] }[] }>(
          '/api/recruit/marketing/campaigns-grouped'
        );
        const opts: TextOption[] = [];
        for (const g of r.groups ?? []) {
          for (const c of g.campaigns ?? []) {
            for (const v of c.variants ?? []) {
              if (!v.label) continue;
              if (v.status !== 'ready' && v.status !== 'approved') continue;
              opts.push({ id: v.id, label: v.label, campaign: c.name });
            }
          }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
        setTextOptions(opts);
      } catch {
        // не критично — селект просто будет пустой
      }
    })();
  }, []);

  /** Сохранить одно поле в config — оптимистично с откатом. */
  async function patchRow(id: string, patch: Record<string, unknown>) {
    setSavingIds((s) => new Set(s).add(id));
    // Оптимистично обновим UI.
    setData((d) => d
      ? { ...d, items: d.items.map((r) => r.id === id ? { ...r, ...patch } as Row : r) }
      : d
    );
    try {
      await safeFetchJson<{ row: unknown }>(`/api/recruit/parser-channels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: patch }),
      });
      setSavedIds((s) => {
        const next = new Set(s);
        next.add(id);
        return next;
      });
      setTimeout(() => {
        setSavedIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // откат — перечитаем
      fetchRows();
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function addUsernames() {
    if (!addText.trim() || adding) return;
    setAdding(true);
    setAddResult(null);
    try {
      const r = await safeFetchJson<{ added: { id: string; username: string }[]; skipped: string[]; requested: number }>(
        '/api/recruit/parser-channels',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames_text: addText }),
        }
      );
      setAddResult(
        `Добавлено ${r.added.length}, пропущено ${r.skipped.length} (уже были). Всего распознано: ${r.requested}.`
      );
      setAddText('');
      setPage(1);
      fetchRows();
    } catch (e) {
      setAddResult(e instanceof Error ? `Ошибка: ${e.message}` : String(e));
    } finally {
      setAdding(false);
    }
  }

  const summary = data?.summary;
  const items = data?.items ?? [];
  const totalPages = data?.page.pages ?? 1;

  const headerCounters = useMemo(() => (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Counter label="🌱 К засеву" value={summary?.seed_ready ?? 0} color="bg-green-100 text-green-900" />
      <Counter label="Я подписан" value={summary?.human_joined ?? 0} color="bg-blue-100 text-blue-900" />
      <Counter label="Можно постить" value={summary?.postable ?? 0} color="bg-amber-100 text-amber-900" />
      <Counter label="Всего" value={summary?.total ?? 0} color="bg-slate-100 text-slate-700" />
    </div>
  ), [summary]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🌱 Готовы к засеву</h1>
          <p className="text-xs text-gray-500 mt-1">
            Отмечай группы, прописывай механику и какой текст в них пускать. Мозг возьмёт seed_ready=true и пойдёт постить.
          </p>
        </div>
        {headerCounters}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ModeButton current={mode} value="ready" onClick={setMode}>🌱 Только готовые</ModeButton>
        <ModeButton current={mode} value="candidate" onClick={setMode}>🧐 Кандидаты (подписан + can_post)</ModeButton>
        <ModeButton current={mode} value="all" onClick={setMode}>Все</ModeButton>
        <input
          type="text"
          placeholder="поиск по @username / названию / городу…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded-md w-72"
        />
      </div>

      <div className="rounded-lg border border-dashed border-emerald-400 bg-emerald-50 p-4">
        <div className="text-sm font-medium text-emerald-900 mb-2">➕ Добавить группы (по @username, можно списком через пробел/строку/запятую):</div>
        <textarea
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          placeholder="@stolica1 @stolica2&#10;https://t.me/foo, @bar"
          className="w-full min-h-[80px] px-3 py-2 text-sm border border-emerald-300 rounded-md bg-white font-mono"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={addUsernames}
            disabled={adding || !addText.trim()}
            className="px-4 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {adding ? 'Добавляю…' : 'Добавить'}
          </button>
          {addResult && <span className="text-xs text-emerald-900">{addResult}</span>}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[1400px] w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left w-[200px]">Группа</th>
              <th className="px-3 py-2 text-right w-[80px]">Участники</th>
              <th className="px-3 py-2 text-left w-[100px]">Постинг</th>
              <th className="px-3 py-2 text-center w-[60px]">Подписан</th>
              <th className="px-3 py-2 text-center w-[60px]">Проверен</th>
              <th className="px-3 py-2 text-center w-[60px]">🌱 К засеву</th>
              <th className="px-3 py-2 text-left w-[260px]">Механика</th>
              <th className="px-3 py-2 text-left w-[200px]">Описание</th>
              <th className="px-3 py-2 text-left w-[200px]">Текст</th>
              <th className="px-3 py-2 text-left w-[120px]">Статус</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">Загрузка…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                {mode === 'ready' ? 'Пока нет групп со «seed_ready=true». Поставь галочку в столбце «🌱 К засеву» в режиме «Все».' : 'Ничего не нашлось'}
              </td></tr>
            )}
            {!loading && items.map((r) => (
              <RowView
                key={r.id}
                r={r}
                saving={savingIds.has(r.id)}
                saved={savedIds.has(r.id)}
                textOptions={textOptions}
                onPatch={(p) => patchRow(r.id, p)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          Стр. {data?.page.page ?? 1} из {totalPages} · всего {data?.page.total ?? 0}
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40"
          >← назад</button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40"
          >вперёд →</button>
          <select
            value={per}
            onChange={(e) => { setPer(Number(e.target.value)); setPage(1); }}
            className="ml-2 px-2 py-1 border border-gray-300 rounded-md"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`px-2.5 py-1 rounded-md text-xs font-semibold ${color}`}>
      {label}: {value}
    </div>
  );
}

function ModeButton({
  current, value, onClick, children,
}: {
  current: FilterMode; value: FilterMode; onClick: (v: FilterMode) => void; children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md border ${
        active ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function RowView({
  r, saving, saved, textOptions, onPatch,
}: {
  r: Row;
  saving: boolean;
  saved: boolean;
  textOptions: TextOption[];
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const [mech, setMech] = useState(r.manual_mechanics ?? '');
  const [desc, setDesc] = useState(r.manual_desc ?? '');
  useEffect(() => { setMech(r.manual_mechanics ?? ''); }, [r.manual_mechanics]);
  useEffect(() => { setDesc(r.manual_desc ?? ''); }, [r.manual_desc]);

  const rowClass = r.seed_ready ? 'bg-emerald-50/60' : '';
  return (
    <tr className={`border-t border-gray-100 ${rowClass}`}>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col">
          {r.link ? (
            <a href={r.link} target="_blank" rel="noreferrer noopener" className="text-blue-700 hover:underline font-mono text-xs">
              @{r.username ?? '?'}
            </a>
          ) : <span className="text-xs font-mono text-gray-500">@{r.username ?? '?'}</span>}
          <span className="text-xs text-gray-700 truncate max-w-[200px]" title={r.name ?? ''}>{r.name ?? ''}</span>
          {(r.city || r.country) && <span className="text-[10px] text-gray-400">{[r.city, r.country].filter(Boolean).join(' · ')}</span>}
          <span className="text-[10px] text-gray-400 mt-0.5">
            {saving && <span className="text-amber-600">сохраняю…</span>}
            {saved && <span className="text-emerald-700">сохранено ✓</span>}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-right align-top tabular-nums">
        {r.members != null ? r.members.toLocaleString('ru-RU') : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-3 py-2 align-top">
        {r.can_post === true && <Tag color="bg-emerald-100 text-emerald-800">свободно</Tag>}
        {r.can_post === false && <Tag color="bg-amber-100 text-amber-800">read-only</Tag>}
        {r.ad_contact && <Tag color="bg-rose-100 text-rose-800" title={r.ad_contact}>💸 платно</Tag>}
        {r.post_via && <div className="text-[10px] text-gray-400 mt-0.5">{r.post_via}</div>}
      </td>
      <td className="px-3 py-2 text-center align-top">
        <input
          type="checkbox"
          checked={r.human_joined === true || r.joined === true}
          onChange={(e) => onPatch({ human_joined: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2 text-center align-top">
        <input
          type="checkbox"
          checked={r.human_verified === true}
          onChange={(e) => onPatch({ human_verified: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2 text-center align-top">
        <input
          type="checkbox"
          checked={r.seed_ready === true}
          onChange={(e) => onPatch({ seed_ready: e.target.checked })}
          className="w-4 h-4 accent-emerald-600"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <textarea
          value={mech}
          onChange={(e) => setMech(e.target.value)}
          onBlur={() => { if ((r.manual_mechanics ?? '') !== mech) onPatch({ manual_mechanics: mech }); }}
          placeholder="как и куда слать (тема/время/через кого)"
          rows={2}
          className="w-full text-xs px-2 py-1 border border-gray-200 rounded resize-y"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => { if ((r.manual_desc ?? '') !== desc) onPatch({ manual_desc: desc }); }}
          placeholder="заметка"
          className="w-full text-xs px-2 py-1 border border-gray-200 rounded"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={r.assigned_text ?? ''}
          onChange={(e) => onPatch({ assigned_text: e.target.value || null })}
          className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-white"
        >
          <option value="">— не задан —</option>
          {textOptions.map((t) => (
            <option key={t.id} value={t.label}>
              {t.label}{t.campaign ? ` · ${t.campaign}` : ''}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <select
          value={r.human_status ?? ''}
          onChange={(e) => onPatch({ human_status: e.target.value || null })}
          className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-white"
        >
          {HUMAN_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </td>
    </tr>
  );
}

function Tag({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>{children}</span>;
}
