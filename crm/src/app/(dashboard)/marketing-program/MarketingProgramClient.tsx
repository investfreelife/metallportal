'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Wrench,
  Compass,
  Code as CodeIcon,
  ListChecks,
  Lightbulb,
  Users,
} from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';

interface Row {
  id: string;
  config: Record<string, unknown> | null;
}

interface ProgramResp {
  program: Row | null;
  checklist: Row | null;
  source_codes: Row | null;
  traction: Row | null;
  tools: Row | null;
  backlog: Row | null;
}

interface ChecklistItem { t: string; done: boolean }
interface CodeRow { code: string; src: string }
interface ChannelRow { name: string; tool?: string; price?: string; status?: string }
interface ToolRow { name: string; status?: string }
interface BacklogRow { t: string; I?: number; C?: number; E?: number; ice?: number; status?: string }

type Tab = 'program' | 'sources' | 'channels' | 'backlog' | 'cohorts';

interface Props { tenantName: string | null }

export default function MarketingProgramClient({ tenantName }: Props) {
  const [resp, setResp] = useState<ProgramResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('program');

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<ProgramResp>('/api/recruit/marketing/program');
      setResp(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const program = resp?.program?.config as { north_star?: string; goal?: string; markdown?: string; version?: string } | undefined;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone size={20} className="text-gray-600" />
            📋 Маркетинг-программа{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          {program && (
            <p className="text-xs text-gray-500 mt-0.5">
              North Star: <strong className="text-gray-700">{program.north_star}</strong> · Цель:{' '}
              <strong className="text-gray-700">{program.goal}</strong>
              {program.version && <span className="text-gray-400"> · v{program.version}</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => reload()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {/* ── Вкладки ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-6 bg-white border-b border-gray-200 overflow-x-auto">
        <TabBtn active={tab === 'program'} onClick={() => setTab('program')} icon={<Target size={12} />}>
          Программа
        </TabBtn>
        <TabBtn active={tab === 'sources'} onClick={() => setTab('sources')} icon={<CodeIcon size={12} />}>
          Источники
        </TabBtn>
        <TabBtn active={tab === 'channels'} onClick={() => setTab('channels')} icon={<Compass size={12} />}>
          Каналы
        </TabBtn>
        <TabBtn active={tab === 'backlog'} onClick={() => setTab('backlog')} icon={<Lightbulb size={12} />}>
          Бэклог
        </TabBtn>
        <TabBtn active={tab === 'cohorts'} onClick={() => setTab('cohorts')} icon={<Users size={12} />}>
          Когорты
        </TabBtn>
      </div>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : !resp ? (
          <p className="text-xs text-gray-400 text-center py-12">Нет данных программы.</p>
        ) : (
          <>
            {tab === 'program' && (
              <ProgramTab program={resp.program} checklist={resp.checklist} tools={resp.tools} onPatched={() => reload(true)} />
            )}
            {tab === 'sources' && <SourcesTab row={resp.source_codes} />}
            {tab === 'channels' && <ChannelsTab row={resp.traction} />}
            {tab === 'backlog' && <BacklogTab row={resp.backlog} />}
            {tab === 'cohorts' && <CohortsTab />}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Вкладка «Программа» ─────────────────────────────────────────── */

function ProgramTab({
  program, checklist, tools, onPatched,
}: {
  program: Row | null;
  checklist: Row | null;
  tools: Row | null;
  onPatched: () => void;
}) {
  const programCfg = program?.config as { north_star?: string; goal?: string; markdown?: string } | undefined;
  const checklistCfg = checklist?.config as { kind: string; items: ChecklistItem[] } | undefined;
  const toolsCfg = tools?.config as { kind: string; tools: ToolRow[] } | undefined;
  const [showMd, setShowMd] = useState(false);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* North Star + Goal */}
      {programCfg && (
        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-lg p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-blue-100 uppercase tracking-wide">North Star</div>
              <div className="text-lg font-bold mt-1">{programCfg.north_star ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-blue-100 uppercase tracking-wide">Цель</div>
              <div className="text-lg font-bold mt-1">{programCfg.goal ?? '—'}</div>
            </div>
          </div>
        </section>
      )}

      {checklistCfg && (
        <ChecklistCard row={checklist!} cfg={checklistCfg} onPatched={onPatched} />
      )}

      {toolsCfg && (
        <ToolsCard cfg={toolsCfg} />
      )}

      {programCfg?.markdown && (
        <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowMd((v) => !v)}
            className="w-full px-4 py-3 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-sm font-semibold text-gray-900">Полный текст программы</span>
            {showMd ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showMd && (
            <pre className="whitespace-pre-wrap text-xs text-gray-800 px-4 py-3 max-h-[60vh] overflow-y-auto leading-relaxed">
              {programCfg.markdown}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}

function ChecklistCard({ row, cfg, onPatched }: { row: Row; cfg: { kind: string; items: ChecklistItem[] }; onPatched: () => void }) {
  const [items, setItems] = useState<ChecklistItem[]>(cfg.items ?? []);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = items.filter((x) => x.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function toggle(i: number) {
    const next = items.map((x, idx) => idx === i ? { ...x, done: !x.done } : x);
    setItems(next);
    setBusy(i); setError(null);
    try {
      await safeFetchJson('/api/recruit/marketing/program', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, config: { ...cfg, items: next } }),
      });
      onPatched();
    } catch (e) {
      // откатываем
      setItems(items);
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <ListChecks size={14} className="text-gray-600" />
          Чек-лист запуска
        </h3>
        <span className="text-[11px] text-gray-700">
          Готово <strong>{done}</strong> из <strong>{total}</strong>
        </span>
      </header>
      <div className="px-4 pt-3">
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {error && (
        <div className="mx-4 mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </div>
      )}
      <ul className="divide-y divide-gray-100 mt-2">
        {items.map((it, i) => (
          <li key={i} className="px-4 py-2 flex items-start gap-2.5 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={!!it.done}
              onChange={() => toggle(i)}
              disabled={busy === i}
              className="mt-0.5 accent-emerald-600"
            />
            <span className={`text-xs leading-snug ${it.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {it.t}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ToolsCard({ cfg }: { cfg: { tools: ToolRow[] } }) {
  const tools = cfg.tools ?? [];
  const done = tools.filter((t) => /^✅/.test(String(t.status ?? ''))).length;
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Wrench size={14} className="text-gray-600" />
          Инструменты
        </h3>
        <span className="text-[11px] text-gray-700">
          ✅ <strong>{done}</strong> из <strong>{tools.length}</strong>
        </span>
      </header>
      <ul className="divide-y divide-gray-100">
        {tools.map((t, i) => (
          <li key={i} className="px-4 py-2 flex items-start gap-2.5 hover:bg-gray-50">
            <span className="text-xs text-gray-800 flex-1 truncate">{t.name}</span>
            <StatusBadge value={t.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── «Источники» ─────────────────────────────────────────────────── */

function SourcesTab({ row }: { row: Row | null }) {
  const cfg = row?.config as { codes: CodeRow[] } | undefined;
  const codes = cfg?.codes ?? [];
  return (
    <div className="space-y-3 max-w-5xl">
      <p className="text-xs text-gray-500">
        Ключёвка: каждый источник = свой код в <code className="bg-gray-100 px-1 rounded">?start=КОД</code>, CPA считаем по нему.
      </p>
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Код</th>
              <th className="px-4 py-2 font-medium">Источник</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {codes.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-gray-400">Нет кодов.</td></tr>
            ) : codes.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <code className="inline-block bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    {c.code}
                  </code>
                </td>
                <td className="px-4 py-2 text-gray-800">{c.src}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ─── «Каналы» ────────────────────────────────────────────────────── */

function ChannelsTab({ row }: { row: Row | null }) {
  const cfg = row?.config as { bullseye?: string[]; channels: ChannelRow[] } | undefined;
  const bullseye = cfg?.bullseye ?? [];
  const channels = cfg?.channels ?? [];
  return (
    <div className="space-y-3 max-w-5xl">
      {bullseye.length > 0 && (
        <section className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
          <div className="text-[10px] text-emerald-800 uppercase tracking-wide mb-2 font-semibold">
            🎯 Bullseye · тестируем сейчас
          </div>
          <div className="flex flex-wrap gap-2">
            {bullseye.map((b, i) => (
              <span key={i} className="inline-block px-3 py-1 bg-white border border-emerald-300 text-emerald-800 text-xs font-medium rounded-full">
                {b}
              </span>
            ))}
          </div>
        </section>
      )}
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Канал</th>
              <th className="px-4 py-2 font-medium">Инструмент</th>
              <th className="px-4 py-2 font-medium">Цена</th>
              <th className="px-4 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {channels.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Нет каналов.</td></tr>
            ) : channels.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900 font-medium">{c.name}</td>
                <td className="px-4 py-2 text-gray-700">{c.tool ?? '—'}</td>
                <td className="px-4 py-2 text-gray-700">{c.price ?? '—'}</td>
                <td className="px-4 py-2"><ChannelStatusBadge value={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ─── «Бэклог» ────────────────────────────────────────────────────── */

function BacklogTab({ row }: { row: Row | null }) {
  const cfg = row?.config as { ideas: BacklogRow[] } | undefined;
  const ideas = useMemo(
    () => (cfg?.ideas ?? []).slice().sort((a, b) => (b.ice ?? 0) - (a.ice ?? 0)),
    [cfg]
  );
  return (
    <div className="space-y-3 max-w-5xl">
      <p className="text-xs text-gray-500">
        Идеи отсортированы по ICE (Impact × Confidence × Ease, среднее). Чем выше — тем приоритетнее.
      </p>
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Идея</th>
              <th className="px-2 py-2 font-medium text-center w-12">I</th>
              <th className="px-2 py-2 font-medium text-center w-12">C</th>
              <th className="px-2 py-2 font-medium text-center w-12">E</th>
              <th className="px-2 py-2 font-medium text-center w-14">ICE</th>
              <th className="px-4 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ideas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Нет идей.</td></tr>
            ) : ideas.map((b, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-800">{b.t}</td>
                <td className="px-2 py-2 text-center text-gray-700">{b.I ?? '—'}</td>
                <td className="px-2 py-2 text-center text-gray-700">{b.C ?? '—'}</td>
                <td className="px-2 py-2 text-center text-gray-700">{b.E ?? '—'}</td>
                <td className="px-2 py-2 text-center text-gray-900 font-bold">{b.ice ?? '—'}</td>
                <td className="px-4 py-2"><StatusBadge value={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* ─── «Когорты» — empty state ────────────────────────────────────── */

function CohortsTab() {
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Users size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">Когорты появятся позже</h2>
      <p className="text-xs text-gray-500 mt-2">
        Наполняется по мере выходов на линию (North Star = вышедших/мес).
      </p>
    </div>
  );
}

/* ─── общие виджеты ──────────────────────────────────────────────── */

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function StatusBadge({ value }: { value?: string }) {
  const v = String(value ?? '').trim();
  if (!v) return <span className="text-[10px] text-gray-400">—</span>;
  // ✅ зелёный / ⚒ янтарный / иначе серый
  const isOk = /^✅/.test(v);
  const isWarn = /^⚒/.test(v) || /срочно|жжёт/i.test(v);
  const cls = isOk
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : isWarn
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>
      {v}
    </span>
  );
}

function ChannelStatusBadge({ value }: { value?: string }) {
  const v = String(value ?? '').trim().toLowerCase();
  let cls = 'bg-gray-100 text-gray-700 border-gray-200';
  if (/тест|test|active/.test(v)) cls = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (/очеред|позже|backlog|план/.test(v)) cls = 'bg-gray-100 text-gray-500 border-gray-200';
  else if (/отказ|reject|нет/.test(v)) cls = 'bg-red-50 text-red-600 border-red-200';
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>
      {value ?? '—'}
    </span>
  );
}
