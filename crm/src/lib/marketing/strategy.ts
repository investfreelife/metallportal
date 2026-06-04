// Типы и метки для «Стратегии маркетинга» (marketing_strategy).

export type StrategyStatus = 'await_approval' | 'approved' | 'revise';

export interface StrategyStep {
  id: string;
  tenant_id: string;
  step_order: number | null;
  title: string | null;
  kind: string | null;
  body: string | null;
  status: StrategyStatus | string | null;
  segment: string | null;
  note: string | null;
  created_at: string;
  updated_at?: string | null;
}

export const STRATEGY_STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  await_approval: { label: 'Ждёт согласования', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500' },
  approved:       { label: 'Согласовано',        color: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
  revise:         { label: 'На правке',          color: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
};

/** Подписи для типа шага (kind). Если неизвестен — показываем сам kind. */
export const STRATEGY_KIND_LABELS: Record<string, string> = {
  audience: '👥 ЦА',
  message:  '💬 Сообщения',
  channel:  '📡 Размещение',
  budget:   '💰 Бюджет',
  metric:   '📊 Метрики',
  pipeline: '🔁 Воронка',
};
