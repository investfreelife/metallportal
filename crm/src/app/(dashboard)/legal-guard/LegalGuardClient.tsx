'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, ExternalLink, RefreshCw, Info } from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { fmtMsk } from '@/lib/tz';

/**
 * Вкладка «🛡 Юр-щит» (ТЗ-075, read-only).
 * Показывает blocklist + флаги + статистику покрытия. Данные пишет демон-мозг.
 * Дисклеймер на видном месте: это РИСК-СКРИНИНГ, не юр-консультация.
 */

interface BlockItem {
  id: string;
  gid: string | null;
  screen_name: string | null;
  name: string | null;
  link: string | null;
  reason: string;
  article: string | null;
  source: string | null;
  checked_at: string;
}
interface GroupScored {
  id: string;
  gid: string | null;
  screen_name: string | null;
  name: string | null;
  link: string | null;
  members: number | null;
  verdict: 'block' | 'flag' | 'clean';
  reasons: string[];
  article: string | null;
  checked_at: string | null;
}
interface Resp {
  blocklist: BlockItem[];
  blocked_groups: GroupScored[];
  flagged: GroupScored[];
  summary: {
    block_permanent: number;
    block_groups: number;
    flag: number;
    checked: number;
    clean: number;
    coverage_pct: number;
    total_groups: number;
  };
  last_checked_at: string | null;
  daemon: { running: boolean; hint: string };
}

export default function LegalGuardClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setLoading(true); setErr(null);
    try {
      const r = await safeFetchJson<Resp>('/api/recruit/legal-guard');
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck size={22} className="text-emerald-700" />
            Юр-щит
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Демон-мозг проверяет группы перед посевом. Здесь — blocklist + флаги. Сеятель и коммент-бот <strong>не действуют</strong> в 🔴 BLOCK / 🟡 FLAG.
          </p>
        </div>
        <button onClick={reload} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-xs rounded hover:bg-gray-50">
          <RefreshCw size={12} />
          Обновить
        </button>
      </header>

      {/* Дисклеймер — обязателен по ТЗ */}
      <div className="mx-6 mt-3 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-start gap-2 text-[11px] text-amber-900">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          <strong>Дисклеймер.</strong> Это автоматический риск-скрининг (лексикон + LLM), <strong>не юридическая консультация</strong>.
          При сомнении демон ставит блок и зовёт человека. Финальное решение — за тобой / юристом. Правила: <code>knowledge-base/19_legal_risk_rf.md</code>.
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {err && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            {err}
          </div>
        )}

        {/* KPI-карточки */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Kpi label="🔴 Постоянный блок" value={data.summary.block_permanent} tone="rose" />
            <Kpi label="🔴 Блок-группы" value={data.summary.block_groups} tone="rose" />
            <Kpi label="🟡 Флаги" value={data.summary.flag} tone="amber" />
            <Kpi label="🟢 Чистые" value={data.summary.clean} tone="emerald" />
            <Kpi label="Проверено" value={`${data.summary.checked} / ${data.summary.total_groups}`} tone="slate" />
            <Kpi label="Покрытие" value={`${data.summary.coverage_pct} %`} tone="slate" />
          </div>
        )}

        {/* Статус демона */}
        {data && (
          <div className={`rounded px-3 py-2 text-[11px] border ${
            data.daemon.running
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}>
            <strong>{data.daemon.running ? '🟢 Демон работает' : '⏸ Демон не подавал признаков жизни'}</strong>
            {data.last_checked_at && <> · последний вердикт: <strong>{fmtMsk(data.last_checked_at, true)}</strong> МСК</>}
            <div className="mt-0.5 opacity-70">{data.daemon.hint}</div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Загрузка…</p>
        ) : !data ? null : (
          <>
            {/* 🔴 Постоянный blocklist (kind=legal_block) */}
            <Section
              icon={<ShieldAlert size={14} className="text-rose-700" />}
              title={`🔴 Постоянный блок · ${data.blocklist.length}`}
              emptyText="Демон ещё не записал ни одной группы в постоянный blocklist."
              items={data.blocklist.length}
            >
              {data.blocklist.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-1.5">Группа</th>
                      <th className="text-left px-2 py-1.5">Статья</th>
                      <th className="text-left px-2 py-1.5">Причина</th>
                      <th className="text-left px-2 py-1.5">Источник</th>
                      <th className="text-right px-3 py-1.5">Когда</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.blocklist.map((b) => (
                      <tr key={b.id} className="bg-rose-50/30">
                        <td className="px-3 py-1.5">
                          {b.link ? (
                            <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline inline-flex items-center gap-1">
                              {b.name ?? b.screen_name ?? b.gid ?? '—'} <ExternalLink size={9} />
                            </a>
                          ) : (b.name ?? b.screen_name ?? b.gid ?? '—')}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-rose-800">{b.article ?? '—'}</td>
                        <td className="px-2 py-1.5 text-gray-800">{b.reason}</td>
                        <td className="px-2 py-1.5 text-gray-500 text-[10px]">{b.source ?? 'auto'}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500 text-[10px]">{fmtMsk(b.checked_at, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {/* 🟡 Флаги — ждут решения */}
            <Section
              icon={<AlertTriangle size={14} className="text-amber-700" />}
              title={`🟡 Флаги · ждут решения · ${data.flagged.length}`}
              emptyText="Флагов нет."
              items={data.flagged.length}
            >
              {data.flagged.length > 0 && <ScoredTable rows={data.flagged} tone="amber" />}
            </Section>

            {/* 🔴 vk_group со статусом block (кэш-вердикт) */}
            {data.blocked_groups.length > 0 && (
              <Section
                icon={<ShieldAlert size={14} className="text-rose-700" />}
                title={`🔴 Группы заблокированы кэш-вердиктом · ${data.blocked_groups.length}`}
                items={data.blocked_groups.length}
              >
                <ScoredTable rows={data.blocked_groups} tone="rose" />
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, emptyText, items, children }: { icon: React.ReactNode; title: string; emptyText?: string; items: number; children?: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded overflow-hidden">
      <header className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
        {icon}
        <h2 className="text-xs font-semibold text-gray-900">{title}</h2>
      </header>
      {items === 0 ? (
        <p className="text-[11px] text-gray-500 px-4 py-4 text-center">{emptyText}</p>
      ) : children}
    </section>
  );
}

function ScoredTable({ rows, tone }: { rows: GroupScored[]; tone: 'rose' | 'amber' }) {
  const rowCls = tone === 'rose' ? 'bg-rose-50/30' : 'bg-amber-50/30';
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 text-gray-500">
        <tr>
          <th className="text-left px-3 py-1.5">Группа</th>
          <th className="text-right px-2 py-1.5">Участники</th>
          <th className="text-left px-2 py-1.5">Статья</th>
          <th className="text-left px-2 py-1.5">Причины</th>
          <th className="text-right px-3 py-1.5">Проверено</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((g) => (
          <tr key={g.id} className={rowCls}>
            <td className="px-3 py-1.5">
              {g.link ? (
                <a href={g.link} target="_blank" rel="noopener noreferrer" className={`hover:underline inline-flex items-center gap-1 ${tone === 'rose' ? 'text-rose-700' : 'text-amber-700'}`}>
                  {g.name ?? g.screen_name ?? g.gid ?? '—'} <ExternalLink size={9} />
                </a>
              ) : (g.name ?? g.screen_name ?? g.gid ?? '—')}
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">{g.members != null ? g.members.toLocaleString('ru-RU') : '—'}</td>
            <td className={`px-2 py-1.5 font-mono ${tone === 'rose' ? 'text-rose-800' : 'text-amber-800'}`}>{g.article ?? '—'}</td>
            <td className="px-2 py-1.5 text-gray-800 max-w-[600px]">
              <div className="flex flex-wrap gap-1">
                {g.reasons.length > 0 ? g.reasons.map((r, i) => (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${tone === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}>{r}</span>
                )) : <span className="text-gray-400 text-[10px]">причина не указана</span>}
              </div>
            </td>
            <td className="px-3 py-1.5 text-right text-gray-500 text-[10px]">{g.checked_at ? fmtMsk(g.checked_at, true) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone: 'rose' | 'amber' | 'emerald' | 'slate' }) {
  const cls = {
    rose:    'bg-rose-50 border-rose-200 text-rose-900',
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    slate:   'bg-slate-50 border-slate-200 text-slate-800',
  }[tone];
  return (
    <div className={`border rounded px-3 py-2 ${cls}`}>
      <div className="text-[10px] uppercase opacity-70">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
