'use client';

import { useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  Target,
  Check,
  PenLine,
  RefreshCw,
  AlertCircle,
  Lock,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { StrategyStep, StrategyStatus } from '@/lib/marketing/strategy';
import { STRATEGY_STATUS_LABELS, STRATEGY_KIND_LABELS } from '@/lib/marketing/strategy';
import { fmtMsk } from '@/lib/tz';


interface Props { tenantName: string | null }

export default function StrategyClient({ tenantName: _tn }: Props) {
  const [steps, setSteps] = useState<StrategyStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<{ steps: StrategyStep[] }>('/api/recruit/marketing/strategy');
      setSteps(j.steps ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }
  useEffect(() => { reload(); }, []);

  /** Индекс первого НЕ approved — следующие за ним «затемняются» (ждут очереди). */
  const firstPendingIdx = useMemo(() => {
    return steps.findIndex((s) => (s.status as StrategyStatus) !== 'approved');
  }, [steps]);

  async function patchStep(id: string, body: Partial<StrategyStep>) {
    const j = await safeFetchJson<{ step: StrategyStep }>(`/api/recruit/marketing/strategy/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSteps((prev) => prev.map((s) => (s.id === id ? j.step : s)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs text-gray-500">
            Пошаговый процесс — каждый шаг согласовывает Сергей. Пока шаг не «✅ Согласован», следующие ждут.
          </p>
        </div>
        <button
          onClick={() => reload()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
      ) : steps.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3 max-w-4xl">
          {steps.map((s, i) => {
            const status = (s.status as StrategyStatus) ?? 'await_approval';
            const dimmed = firstPendingIdx >= 0 && i > firstPendingIdx;
            return (
              <StepCard
                key={s.id}
                step={s}
                status={status}
                dimmed={dimmed}
                isCurrent={i === firstPendingIdx}
                onApprove={() => patchStep(s.id, { status: 'approved', note: null })}
                onRevise={(comment) => patchStep(s.id, { status: 'revise', note: comment })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepCard({
  step, status, dimmed, isCurrent, onApprove, onRevise,
}: {
  step: StrategyStep;
  status: StrategyStatus;
  dimmed: boolean;
  isCurrent: boolean;
  onApprove: () => void | Promise<void>;
  onRevise: (comment: string) => void | Promise<void>;
}) {
  const meta = STRATEGY_STATUS_LABELS[status] ?? STRATEGY_STATUS_LABELS.await_approval;
  const kindLabel = STRATEGY_KIND_LABELS[step.kind ?? ''] ?? step.kind ?? null;
  const [expanded, setExpanded] = useState<boolean>(status === 'await_approval' || isCurrent || status === 'revise');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [comment, setComment] = useState(step.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doApprove() {
    setBusy(true); setError(null);
    try { await onApprove(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function doRevise() {
    if (!comment.trim()) { setError('Напиши, что поправить'); return; }
    setBusy(true); setError(null);
    try {
      await onRevise(comment.trim());
      setReviseOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden transition-all ${
        dimmed ? 'opacity-50 border-gray-200' :
        status === 'approved' ? 'border-emerald-200' :
        status === 'revise' ? 'border-orange-300 ring-1 ring-orange-100' :
        isCurrent ? 'border-amber-300 ring-2 ring-amber-100 shadow-sm' :
        'border-gray-200'
      }`}
    >
      <header className="px-4 py-3 border-b border-gray-100 flex items-start gap-3">
        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
          status === 'approved' ? 'bg-emerald-600 text-white' :
          status === 'revise' ? 'bg-orange-500 text-white' :
          'bg-amber-100 text-amber-800 border border-amber-300'
        }`}>
          {step.step_order ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 leading-tight">{step.title || `Шаг ${step.step_order ?? ''}`}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            {kindLabel && (
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                {kindLabel}
              </span>
            )}
            {step.segment && (
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">
                сегмент: {step.segment}
              </span>
            )}
            {dimmed && <span className="text-[10px] text-gray-500 inline-flex items-center gap-0.5"><Lock size={9} /> ждёт предыдущий</span>}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 text-gray-500 hover:text-gray-900 rounded"
          title={expanded ? 'Свернуть' : 'Развернуть'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </header>

      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {step.body && (
            <div className="text-xs text-gray-800 whitespace-pre-wrap break-words leading-relaxed bg-gray-50 border border-gray-100 rounded p-2 max-h-72 overflow-y-auto">
              {step.body}
            </div>
          )}

          {status === 'revise' && step.note && (
            <div className="text-[11px] text-orange-800 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
              <strong>На правке:</strong> {step.note}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>
          )}

          {/* Действия — только когда не dimmed и не approved (на approved тоже даём «отозвать»). */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {status !== 'approved' && (
              <>
                {!reviseOpen ? (
                  <button
                    onClick={() => setReviseOpen(true)}
                    disabled={dimmed || busy}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 text-xs font-medium rounded-md hover:bg-orange-50 disabled:opacity-40"
                  >
                    <PenLine size={11} /> Поправить
                  </button>
                ) : (
                  <div className="w-full">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Что поправить?"
                      className="w-full px-2.5 py-1.5 text-xs border border-orange-200 rounded focus:border-orange-400 focus:outline-none resize-y"
                    />
                    <div className="flex items-center justify-end gap-2 mt-1.5">
                      <button onClick={() => { setReviseOpen(false); setComment(step.note ?? ''); }} className="px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100 rounded">Отмена</button>
                      <button onClick={doRevise} disabled={busy || !comment.trim()} className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40">
                        <PenLine size={10} /> {busy ? 'Сохранение…' : 'Поправить'}
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={doApprove}
                  disabled={dimmed || busy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-40"
                >
                  <Check size={11} /> Согласовать
                </button>
              </>
            )}
            {status === 'approved' && (
              <button
                onClick={() => onRevise(comment.trim() || 'Возвращён на доработку')}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 text-xs font-medium rounded-md hover:bg-orange-50 disabled:opacity-40"
              >
                <X size={11} /> Снять согласование
              </button>
            )}
          </div>
          <div className="text-[10px] text-gray-400 text-right">
            обновлено {fmtMsk(step.updated_at ?? step.created_at, true)} МСК
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 max-w-md mx-auto">
      <Target size={36} className="text-gray-300 mx-auto mb-3" />
      <h2 className="text-sm font-medium text-gray-700">Стратегии пока нет</h2>
      <p className="text-xs text-gray-500 mt-2">
        Шаги стратегии (ЦА, сообщения, размещение, бюджет, метрики) появятся здесь — обычно их готовит мозг
        и присылает на согласование. Подождите минут 5 или попросите его собрать стратегию.
      </p>
    </div>
  );
}
