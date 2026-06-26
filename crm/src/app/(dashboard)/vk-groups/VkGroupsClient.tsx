'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Trash2, Plus, X, Save, RefreshCw } from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';

/**
 * /vk-groups — каталог VK-сообществ + ручное управление. Sergey directive
 * 2026-06-06: «как в Telegram — добавить новое, редактировать существующее,
 * описание, фильтр можно-писать/платно».
 *
 * post_mode: own/open/suggest/comments/paid/ads/closed.
 *   - «Можно писать» = own/open/suggest/comments (мы сами доставим пост).
 *   - «Платно»       = paid/ads ИЛИ задан ad_contact (через админа/Ads).
 */

const POST_MODES: Array<{ v: string; label: string; cls: string }> = [
  { v: 'own',      label: '🏠 наше',         cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { v: 'open',     label: '🟢 открытая стена', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { v: 'suggest',  label: '✍️ предложка',    cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { v: 'comments', label: '💬 комменты',      cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  { v: 'paid',     label: '💸 платно (админ)', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  { v: 'ads',      label: '📢 VK Ads',        cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  { v: 'closed',   label: '🔒 закрыто',       cls: 'bg-rose-100 text-rose-700 border-rose-200' },
];
const HUMAN_STATUS: Array<{ v: string; label: string }> = [
  { v: '',         label: '—' },
  { v: 'ready',    label: '✅ готова' },
  { v: 'paid',     label: '💸 платное' },
  { v: 'admin',    label: '👮 только админ' },
  { v: 'rejected', label: '❌ отказали' },
  { v: 'testing', label: '🧪 тест' },
];

type PostFilter = '' | 'yes' | 'paid';

interface Row {
  id: string;
  name: string | null;
  status: string | null;
  screen_name: string | null;
  vk_id: number | null;
  link: string | null;
  members: number | null;
  is_closed: boolean | null;
  can_post: boolean | null;
  post_mode: string | null;
  ad_contact: string | null;
  ad_link: string | null;
  city: string | null;
  found_query: string | null;
  manual_desc: string | null;
  manual_mechanics: string | null;
  seed_ready: boolean | null;
  human_status: string | null;
  human_verified: boolean | null;
  source: string | null;
  manual: boolean;
  created_at: string;
}

interface ListResp {
  items: Row[];
  summary: {
    total: number;
    can_write: number;
    paid: number;
    open: number;
    suggest: number;
    comments: number;
    ads: number;
    closed: number;
    seed_ready: number;
  };
  page: { page: number; per: number; total: number; pages: number };
}

export default function VkGroupsClient() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<string>('');
  const [post, setPost] = useState<PostFilter>('');
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(50);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [addBatch, setAddBatch] = useState('');
  const [addResult, setAddResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      if (mode) sp.set('mode', mode);
      if (post) sp.set('post', post);
      sp.set('page', String(page));
      sp.set('per', String(per));
      const j = await safeFetchJson<ListResp>(`/api/recruit/vk-groups?${sp.toString()}`);
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [q, mode, post, page, per]);
  useEffect(() => { reload(); }, [reload]);

  async function addBatchSubmit() {
    if (!addBatch.trim() || busy) return;
    setBusy(true); setAddResult(null);
    try {
      const r = await safeFetchJson<{ added: { id: string; screen_name: string }[]; skipped: string[]; requested: number }>(
        '/api/recruit/vk-groups',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ screens_text: addBatch }) }
      );
      setAddResult(`Добавлено ${r.added.length}, пропущено ${r.skipped.length} (уже были). Всего распознано: ${r.requested}.`);
      setAddBatch('');
      setPage(1);
      reload();
    } catch (e) {
      setAddResult(e instanceof Error ? `Ошибка: ${e.message}` : String(e));
    } finally { setBusy(false); }
  }

  async function deleteRow(id: string) {
    if (!confirm('Удалить эту VK-группу из каталога?')) return;
    try {
      await safeFetchJson(`/api/recruit/vk-groups/${id}`, { method: 'DELETE' });
      reload();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  const summary = data?.summary;
  const items = data?.items ?? [];
  const totalPages = data?.page.pages ?? 1;

  const counters = useMemo(() => (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <Counter label="Всего" v={summary?.total ?? 0} cls="bg-slate-100 text-slate-700" />
      <Counter label="✍️ Можно писать" v={summary?.can_write ?? 0} cls="bg-emerald-100 text-emerald-900" />
      <Counter label="💸 Платно" v={summary?.paid ?? 0} cls="bg-amber-100 text-amber-900" />
      <Counter label="📢 Ads" v={summary?.ads ?? 0} cls="bg-orange-100 text-orange-900" />
      <Counter label="🔒 Закрыто" v={summary?.closed ?? 0} cls="bg-rose-100 text-rose-900" />
      <Counter label="🌱 К засеву" v={summary?.seed_ready ?? 0} cls="bg-green-100 text-green-900" />
    </div>
  ), [summary]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">VK группы · каталог сообществ</h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Разведка аудитории ВКонтакте + ручная разметка. VK API не постит на чужие стены — смотри «как достучаться».
          </p>
        </div>
        {counters}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipBtn active={post === ''} onClick={() => { setPost(''); setPage(1); }}>Все</ChipBtn>
        <ChipBtn active={post === 'yes'} onClick={() => { setPost('yes'); setPage(1); }}>✍️ Можно писать</ChipBtn>
        <ChipBtn active={post === 'paid'} onClick={() => { setPost('paid'); setPage(1); }}>💸 Можно писать платно</ChipBtn>
        <select
          value={mode}
          onChange={(e) => { setMode(e.target.value); setPage(1); }}
          className="ml-2 px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
        >
          <option value="">post_mode: любой</option>
          {POST_MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
        </select>
        <input
          type="text"
          placeholder="поиск по названию / screen_name / городу…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded-md w-72"
        />
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 inline-flex items-center gap-1"
        >
          <Plus size={14} /> Добавить
        </button>
        <button
          onClick={reload}
          disabled={loading}
          className="px-2.5 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>

      {adding && (
        <div className="rounded-lg border border-dashed border-emerald-400 bg-emerald-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-emerald-900">
              ➕ Добавить VK-группы списком (vk.com/&lt;screen&gt; или &lt;screen&gt; через пробел/строки/запятую)
            </div>
            <button onClick={() => { setAdding(false); setAddResult(null); }} className="text-emerald-900 hover:text-emerald-700">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={addBatch}
            onChange={(e) => setAddBatch(e.target.value)}
            placeholder="vk.com/dostavka_msk&#10;https://vk.com/club12345, work_msk"
            className="w-full min-h-[80px] px-3 py-2 text-sm border border-emerald-300 rounded-md bg-white font-mono"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={addBatchSubmit}
              disabled={busy || !addBatch.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Добавляю…' : 'Добавить пачкой'}
            </button>
            {addResult && <span className="text-xs text-emerald-900">{addResult}</span>}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left w-[260px]">Сообщество</th>
              <th className="px-3 py-2 text-right w-[80px]">Участники</th>
              <th className="px-3 py-2 text-left w-[160px]">Как достучаться</th>
              <th className="px-3 py-2 text-left w-[100px]">Город</th>
              <th className="px-3 py-2 text-left">Описание</th>
              <th className="px-3 py-2 text-left w-[100px]">Статус</th>
              <th className="px-3 py-2 text-right w-[110px]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Загрузка…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                Ничего не нашлось. Добавь группы кнопкой «➕ Добавить» или подожди парсер.
              </td></tr>
            )}
            {!loading && items.map((g) => {
              const m = POST_MODES.find((x) => x.v === g.post_mode);
              const statusMeta = HUMAN_STATUS.find((s) => s.v === (g.human_status ?? ''));
              return (
                <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      {g.link ? (
                        <a href={g.link} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline inline-flex items-center gap-1 text-sm font-medium">
                          {g.name} <ExternalLink size={10} />
                        </a>
                      ) : <span className="text-sm font-medium">{g.name}</span>}
                      {g.screen_name && <span className="text-[10px] text-gray-400 font-mono">@{g.screen_name}</span>}
                      {g.found_query && <span className="text-[10px] text-gray-400">по запросу: {g.found_query}</span>}
                      {g.manual && <span className="text-[10px] text-emerald-700">✋ вручную</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">
                    {g.members != null ? g.members.toLocaleString('ru-RU') : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {m && <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] ${m.cls}`}>{m.label}</span>}
                    {!m && g.post_mode && <span className="text-[10px] text-gray-500">{g.post_mode}</span>}
                    {!g.post_mode && <span className="text-[10px] text-gray-300">—</span>}
                    {g.ad_contact && (
                      <div className="mt-1">
                        {g.ad_link ? (
                          <a href={g.ad_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-700 hover:underline">💬 {g.ad_contact}</a>
                        ) : <span className="text-[10px] text-amber-700">💬 {g.ad_contact}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-600">{g.city ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-xs text-gray-800 whitespace-pre-wrap break-words max-w-[600px]">
                      {g.manual_desc ?? <span className="text-gray-300">—</span>}
                    </div>
                    {g.manual_mechanics && (
                      <div className="text-[10px] text-gray-500 mt-1 whitespace-pre-wrap">
                        <strong>механика:</strong> {g.manual_mechanics}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {statusMeta && statusMeta.v && <span className="text-[10px]">{statusMeta.label}</span>}
                    {g.seed_ready && <div className="text-[10px] text-emerald-700">🌱 к засеву</div>}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <button
                      onClick={() => setEditing(g)}
                      className="px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded inline-flex items-center gap-1"
                    >
                      <Pencil size={11} /> Изм.
                    </button>
                    <button
                      onClick={() => deleteRow(g.id)}
                      className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded inline-flex items-center gap-1 ml-1"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          Стр. {data?.page.page ?? 1} из {totalPages} · всего {data?.page.total ?? 0}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40">← назад</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40">вперёд →</button>
          <select value={per} onChange={(e) => { setPer(Number(e.target.value)); setPage(1); }} className="ml-2 px-2 py-1 border border-gray-300 rounded-md">
            <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
          </select>
        </div>
      </div>

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function Counter({ label, v, cls }: { label: string; v: number; cls: string }) {
  return <span className={`px-2 py-0.5 rounded ${cls} font-medium`}>{label}: {v}</span>;
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-md border ${active ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
    >{children}</button>
  );
}

function EditModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row.name ?? '');
  const [screen, setScreen] = useState(row.screen_name ?? '');
  const [members, setMembers] = useState<number | ''>(row.members ?? '');
  const [postMode, setPostMode] = useState(row.post_mode ?? '');
  const [adContact, setAdContact] = useState(row.ad_contact ?? '');
  const [city, setCity] = useState(row.city ?? '');
  const [desc, setDesc] = useState(row.manual_desc ?? '');
  const [mech, setMech] = useState(row.manual_mechanics ?? '');
  const [seedReady, setSeedReady] = useState(row.seed_ready === true);
  const [verified, setVerified] = useState(row.human_verified === true);
  const [humanStatus, setHumanStatus] = useState(row.human_status ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await safeFetchJson(`/api/recruit/vk-groups/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          config: {
            screen_name: screen,
            members: members === '' ? null : members,
            post_mode: postMode || null,
            ad_contact: adContact,
            city,
            manual_desc: desc,
            manual_mechanics: mech,
            seed_ready: seedReady,
            human_verified: verified,
            human_status: humanStatus || null,
          },
        }),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold">Редактировать VK-группу</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Field label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="screen_name (без @, без vk.com/)">
              <input value={screen} onChange={(e) => setScreen(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded font-mono" />
            </Field>
            <Field label="Участники">
              <input type="number" value={members} onChange={(e) => setMembers(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Как достучаться (post_mode)">
              <select value={postMode} onChange={(e) => setPostMode(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white">
                <option value="">—</option>
                {POST_MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Контакт для платного (админ/менеджер)">
              <input value={adContact} onChange={(e) => setAdContact(e.target.value)} placeholder="@username или ссылка vk.com/id…" className="w-full px-2 py-1.5 border border-gray-300 rounded" />
            </Field>
          </div>
          <Field label="Город">
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded" />
          </Field>
          <Field label="📝 Описание (заметка человеку)">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded" placeholder="о чём группа, какая аудитория, какие посты заходят…" />
          </Field>
          <Field label="🎯 Механика постинга">
            <textarea value={mech} onChange={(e) => setMech(e.target.value)} rows={3} className="w-full px-2 py-1.5 border border-gray-300 rounded" placeholder="как и куда слать (тема/время/через кого)…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Статус">
              <select value={humanStatus} onChange={(e) => setHumanStatus(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white">
                {HUMAN_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Флаги">
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={seedReady} onChange={(e) => setSeedReady(e.target.checked)} className="accent-emerald-600" /> 🌱 к засеву</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> ✓ проверено</label>
              </div>
            </Field>
          </div>
          {err && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</div>}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Отмена</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1">
            <Save size={12} /> {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  );
}
