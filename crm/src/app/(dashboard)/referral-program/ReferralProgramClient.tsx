'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift, RefreshCw, AlertCircle, Trophy, Save, Check } from 'lucide-react';
import { safeFetchJson } from '@/lib/safe-fetch';
import { fmtMsk } from '@/lib/tz';

interface StatusItem { name: string; active_needed: number }
interface ProgramConfig {
  enabled?: boolean;
  inviter_reward?: number;
  inviter_threshold_shifts?: number;
  newbie_reward?: number;
  statuses?: StatusItem[];
  leaderboard?: boolean;
  note?: string;
  rules_human?: string;
  qualify_months?: number;
}
interface ProgramRow {
  id: string;
  config: ProgramConfig & { kind?: string };
}
interface ReferralRow {
  id: string;
  config: Record<string, unknown>;
  created_at: string;
}
interface ListResp {
  items: ReferralRow[];
  summary: { total: number; pending: number; approved: number; paid: number; rejected: number; due_amount: number };
  leaderboard: { tg: string; name: string; approved: number; earned: number }[];
}

interface Props { tenantName: string | null }

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: '⏳ ожидание', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: '✅ одобрен',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  paid:     { label: '💸 выплачен', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  rejected: { label: '❌ отказ',    color: 'bg-red-50 text-red-600 border-red-200' },
};

export default function ReferralProgramClient({ tenantName }: Props) {
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [list, setList] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([
        safeFetchJson<{ program: ProgramRow | null }>('/api/recruit/referral/program'),
        safeFetchJson<ListResp>('/api/recruit/referral/list'),
      ]);
      setProgram(p.program ?? null);
      setList(l ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function patchRef(id: string, patch: Record<string, unknown>) {
    try {
      await safeFetchJson(`/api/recruit/referral/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await reload();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Gift size={20} className="text-pink-600" />
            🎁 Реферальная программа{tenantName ? ` · ${tenantName}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Структура (суммы/статусы), таблица рефералов с approve/pay, топ-лидерборд.
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* ── 1. Структура ─────────────────────────────────────── */}
        {program && <ProgramCard program={program} onSaved={reload} />}

        {/* ── 2. Сводка ─────────────────────────────────────── */}
        {list && (
          <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat label="Всего рефералов" value={list.summary.total} />
            <Stat label="Ждут" value={list.summary.pending} color="amber" />
            <Stat label="Одобрено" value={list.summary.approved} color="emerald" />
            <Stat label="Выплачено" value={list.summary.paid} color="blue" />
            <Stat label="К выплате" value={`${list.summary.due_amount.toLocaleString('ru-RU')} ₽`} color="emerald" />
          </section>
        )}

        {/* ── 3. Лидерборд ─────────────────────────────────── */}
        {list && list.leaderboard.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <header className="px-4 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
              <Trophy size={13} className="text-amber-600" />
              <h3 className="text-sm font-semibold text-gray-900">Топ-рекрутёры</h3>
            </header>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">Рекрутёр</th>
                  <th className="px-3 py-1.5">Активных</th>
                  <th className="px-3 py-1.5">Заработано (₽)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.leaderboard.map((l, i) => (
                  <tr key={l.tg} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-700">{i + 1}</td>
                    <td className="px-3 py-1.5 text-gray-900 font-medium">{l.name} <span className="text-gray-400">({l.tg})</span></td>
                    <td className="px-3 py-1.5 text-emerald-700 font-bold">{l.approved}</td>
                    <td className="px-3 py-1.5 text-gray-700">{l.earned.toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── 4. Таблица рефералов ────────────────────────────── */}
        <section className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <header className="px-4 py-2 border-b border-gray-100 bg-gray-50/60">
            <h3 className="text-sm font-semibold text-gray-900">Рефералы</h3>
          </header>
          {!list || list.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 px-4">
              Пока нет рефералов. Когда бот получит <code>/start ref_&lt;id&gt;</code> — появятся здесь.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-1.5">Рекрутёр</th>
                  <th className="px-3 py-1.5">→</th>
                  <th className="px-3 py-1.5">Новичок</th>
                  <th className="px-3 py-1.5 text-center">Смены</th>
                  <th className="px-3 py-1.5 text-center">Награда</th>
                  <th className="px-3 py-1.5">Статус</th>
                  <th className="px-3 py-1.5">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.items.map((r) => {
                  const c = r.config as Record<string, unknown>;
                  const status = String(c.status ?? 'pending');
                  const meta = STATUS_META[status] ?? STATUS_META.pending;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-900">{String(c.referrer_name ?? c.referrer_tg ?? '—')}</td>
                      <td className="px-3 py-1.5 text-gray-400">→</td>
                      <td className="px-3 py-1.5 text-gray-700">{String(c.referee_name ?? c.referee_tg ?? '—')}</td>
                      <td className="px-3 py-1.5 text-center">{Number(c.shifts ?? 0)}</td>
                      <td className="px-3 py-1.5 text-center font-medium">{Number(c.reward ?? 0).toLocaleString('ru-RU')} ₽</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          {status !== 'approved' && status !== 'paid' && (
                            <button onClick={() => patchRef(r.id, { status: 'approved' })} className="px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded hover:bg-emerald-700">approve</button>
                          )}
                          {status === 'approved' && (
                            <button onClick={() => patchRef(r.id, { status: 'paid' })} className="px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700">pay</button>
                          )}
                          {status !== 'rejected' && status !== 'paid' && (
                            <button onClick={() => patchRef(r.id, { status: 'rejected' })} className="px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded">reject</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, color = 'blue' }: { label: string; value: number | string; color?: 'blue' | 'amber' | 'emerald' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`border rounded-md px-3 py-2 ${colors[color]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function ProgramCard({ program, onSaved }: { program: ProgramRow; onSaved: () => Promise<void> | void }) {
  const c = program.config;
  const [enabled, setEnabled] = useState<boolean>(c.enabled !== false);
  const [inviterReward, setInviterReward] = useState<number>(c.inviter_reward ?? 3000);
  const [newbieReward, setNewbieReward] = useState<number>(c.newbie_reward ?? 2000);
  const [statuses, setStatuses] = useState<StatusItem[]>(c.statuses ?? []);
  const [leaderboard, setLeaderboard] = useState<boolean>(c.leaderboard !== false);
  const [note, setNote] = useState<string>(c.note ?? '');
  const [rulesHuman, setRulesHuman] = useState<string>(c.rules_human ?? '');
  const [qualifyMonths, setQualifyMonths] = useState<number>(c.qualify_months ?? 1);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      await safeFetchJson('/api/recruit/referral/program', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled, inviter_reward: inviterReward,
          newbie_reward: newbieReward, statuses, leaderboard, note, rules_human: rulesHuman,
          qualify_months: qualifyMonths,
        }),
      });
      setSavedAt(new Date().toISOString());
      await onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Gift size={13} className="text-pink-600" /> Структура программы
        </h3>
        <label className="text-xs flex items-center gap-1.5">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-emerald-600" />
          {enabled ? '✅ включена' : '⏸ выключена'}
        </label>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Приведшему (до ₽ за друга, потолок)">
          <input type="number" value={inviterReward} onChange={(e) => setInviterReward(Number(e.target.value) || 0)}
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
        </Field>
        <Field label="Порог: месяцев работы друга">
          <input type="number" value={qualifyMonths} onChange={(e) => setQualifyMonths(Number(e.target.value) || 0)}
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
        </Field>
        <Field label="Новичку (₽ к первым сменам)">
          <input type="number" value={newbieReward} onChange={(e) => setNewbieReward(Number(e.target.value) || 0)}
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
        </Field>
      </div>

      <Field label="Статусы рекрутёров (имя → нужно активных)">
        <div className="space-y-1">
          {statuses.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={s.name} onChange={(e) => setStatuses(statuses.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="w-24 px-2 py-1 text-xs border border-gray-200 rounded" />
              <span className="text-gray-400 text-xs">→</span>
              <input type="number" value={s.active_needed}
                onChange={(e) => setStatuses(statuses.map((x, j) => j === i ? { ...x, active_needed: Number(e.target.value) || 0 } : x))}
                className="w-16 px-2 py-1 text-xs border border-gray-200 rounded" />
              <button onClick={() => setStatuses(statuses.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:bg-red-50 px-1 rounded">×</button>
            </div>
          ))}
          <button onClick={() => setStatuses([...statuses, { name: '🆕', active_needed: 1 }])}
            className="text-[11px] text-blue-700 hover:bg-blue-50 px-1 py-0.5 rounded">+ статус</button>
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <label className="text-xs flex items-center gap-1.5">
          <input type="checkbox" checked={leaderboard} onChange={(e) => setLeaderboard(e.target.checked)} />
          🏆 Лидерборд активен
        </label>
      </div>

      <Field label="Заметка">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="источник, дата подтверждения и т.п."
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded" />
      </Field>

      {/* Подробные правила программы — человеческое описание (как работает, сколько, условия) */}
      <Field label="📖 Подробные правила (как это работает)">
        <textarea value={rulesHuman} onChange={(e) => setRulesHuman(e.target.value)} rows={22}
          placeholder="Полное описание реферальной программы простыми словами…"
          className="w-full px-2 py-2 text-xs border border-gray-200 rounded font-mono leading-relaxed whitespace-pre-wrap" />
        {rulesHuman && (
          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-md p-3 text-[12px] text-emerald-900 whitespace-pre-wrap leading-relaxed">
            {rulesHuman}
          </div>
        )}
      </Field>

      {/* Предпросмотр для бота */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-[11px] text-amber-900">
        <div className="font-semibold mb-0.5">🎁 Так увидит водитель в боте:</div>
        <div className="whitespace-pre-wrap">
{`Реферальная программа парка «Столица»
• Приведи водителя → до ${inviterReward.toLocaleString('ru-RU')} ₽ после ${qualifyMonths} мес. его работы
• Новичку — ${newbieReward.toLocaleString('ru-RU')} ₽ бонусом
${statuses.map((s) => `• ${s.name} — ${s.active_needed} активных`).join('\n')}

Твоя ссылка: t.me/<bot_username>?start=ref_<tg_id>`}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {savedAt && (
          <span className="text-[10px] text-emerald-700 inline-flex items-center gap-1">
            <Check size={10} /> сохранено {fmtMsk(savedAt, true)}
          </span>
        )}
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40">
          <Save size={12} /> {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </section>
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
