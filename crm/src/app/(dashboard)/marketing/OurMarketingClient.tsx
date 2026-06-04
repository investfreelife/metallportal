'use client';

import { useEffect, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Rocket,
  Trophy,
  Target,
  Megaphone,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  AlertCircle,
  Users,
} from 'lucide-react';
import type { StrategyStep, StrategyStatus } from '@/lib/marketing/strategy';
import { STRATEGY_STATUS_LABELS, STRATEGY_KIND_LABELS } from '@/lib/marketing/strategy';
import type { Campaign, AdVariant } from '@/lib/marketing/types';

interface CampaignWithVariants extends Campaign {
  variants: AdVariant[];
}
interface Group {
  seg_order: number | null;
  segment: string | null;
  portrait: string | null;
  campaigns: CampaignWithVariants[];
}

interface Props {
  tenantName: string | null;
  onJumpTab: (tab: 'strategy' | 'campaigns') => void;
}

export default function OurMarketingClient({ tenantName: _tn, onJumpTab }: Props) {
  const [steps, setSteps] = useState<StrategyStep[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, g] = await Promise.all([
          safeFetchJson<{ steps: StrategyStep[] }>('/api/recruit/marketing/strategy'),
          safeFetchJson<{ groups: Group[] }>('/api/recruit/marketing/campaigns-grouped'),
        ]);
        setSteps(s.steps ?? []);
        setGroups(g.groups ?? []);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const benchmark = steps.find((s) => s.kind === 'benchmark') ?? null;
  const planSteps = steps.filter((s) => s.kind !== 'benchmark');
  const approvedCount = planSteps.filter((s) => s.status === 'approved').length;
  const totalCampaigns = groups.reduce((n, g) => n + g.campaigns.length, 0);
  const totalVariants = groups.reduce(
    (n, g) => n + g.campaigns.reduce((m, c) => m + c.variants.length, 0),
    0
  );

  if (loading) return <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>;
  if (error) {
    return (
      <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-lg p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Rocket size={20} />
          <h2 className="text-lg font-bold">Наш маркетинг</h2>
        </div>
        <p className="text-xs text-blue-100 leading-relaxed">
          Что мы строим: стратегия → портреты ЦА → кампании → сообщения. Всё уже согласовано или
          ждёт твоего ✅ — кнопки внизу ведут в детали.
        </p>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Stat label="Шагов стратегии" value={planSteps.length} sub={`${approvedCount} согласовано`} />
          <Stat label="Кампаний" value={totalCampaigns} sub={`по ${groups.filter((g) => g.seg_order != null).length} ЦА`} />
          <Stat label="Сообщений" value={totalVariants} sub="связки A/B/C" />
        </div>
      </header>

      {/* ── Benchmark / козыри ──────────────────────────────────── */}
      {benchmark && <BenchmarkCard step={benchmark} />}

      {/* ── Стратегия (короткий список) ─────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Target size={14} className="text-gray-600" />
            Стратегия ({planSteps.length})
          </h3>
          <button
            onClick={() => onJumpTab('strategy')}
            className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Согласовать пошагово <ArrowRight size={11} />
          </button>
        </header>
        <div className="divide-y divide-gray-100">
          {planSteps.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-4">Шагов нет — мозг ещё не собрал стратегию.</p>
          ) : (
            planSteps.map((s) => <StrategySummaryRow key={s.id} step={s} />)
          )}
        </div>
      </section>

      {/* ── Кампании (короткий список по сегментам) ─────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Megaphone size={14} className="text-gray-600" />
            Кампании по портретам ЦА ({groups.length})
          </h3>
          <button
            onClick={() => onJumpTab('campaigns')}
            className="text-[11px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Открыть все <ArrowRight size={11} />
          </button>
        </header>
        <div className="divide-y divide-gray-100">
          {groups.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-4">Кампаний нет.</p>
          ) : (
            groups.map((g) => (
              <div key={String(g.seg_order ?? 'none')} className="px-4 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                    {g.seg_order ?? '·'}
                  </span>
                  <Users size={11} className="text-gray-500" />
                  <span className="text-xs font-medium text-gray-900 flex-1 truncate">{g.segment ?? 'Без сегмента'}</span>
                  <span className="text-[10px] text-gray-500">{g.campaigns.length} камп., {g.campaigns.reduce((n, c) => n + c.variants.length, 0)} сообщ.</span>
                </div>
                {g.campaigns.map((c) => (
                  <div key={c.id} className="ml-7 text-[11px] text-gray-700 truncate">
                    📣 {c.name}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
      <div className="text-[10px] text-blue-100 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-blue-100 mt-0.5">{sub}</div>}
    </div>
  );
}

function BenchmarkCard({ step }: { step: StrategyStep }) {
  const [expanded, setExpanded] = useState(true);
  const text = step.body ?? '';
  return (
    <section className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-amber-200/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
          <Trophy size={14} className="text-amber-700" />
          {step.title ?? 'Бенчмарк · Козыри vs конкуренты'}
        </h3>
        <button onClick={() => setExpanded((v) => !v)} className="text-amber-800 hover:text-amber-900">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </header>
      {expanded && (
        <div className="px-4 py-3">
          <div className="text-xs text-gray-800 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto">
            {text || '(пусто — мозг ещё не написал бенчмарк)'}
          </div>
        </div>
      )}
    </section>
  );
}

function StrategySummaryRow({ step }: { step: StrategyStep }) {
  const status = (step.status as StrategyStatus) ?? 'await_approval';
  const meta = STRATEGY_STATUS_LABELS[status] ?? STRATEGY_STATUS_LABELS.await_approval;
  const kindLabel = STRATEGY_KIND_LABELS[step.kind ?? ''] ?? step.kind ?? null;
  return (
    <div className="px-4 py-2.5 flex items-start gap-2.5 hover:bg-gray-50">
      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold flex-shrink-0 ${
        status === 'approved' ? 'bg-emerald-600 text-white' :
        status === 'revise' ? 'bg-orange-500 text-white' :
        'bg-amber-100 text-amber-800 border border-amber-300'
      }`}>
        {step.step_order ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-900 truncate">{step.title || `Шаг ${step.step_order ?? ''}`}</div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[9px] px-1 py-0 rounded border ${meta.color}`}>
            <span className={`inline-block w-1 h-1 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          {kindLabel && (
            <span className="text-[9px] px-1 py-0 rounded bg-gray-100 text-gray-700 border border-gray-200">
              {kindLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
