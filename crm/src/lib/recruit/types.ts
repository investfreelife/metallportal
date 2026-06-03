// Типы для рекрутингового модуля CRM (диалоги + воронка).

export type DialogStage = 'new' | 'engaged' | 'wants' | 'docs' | 'on_line' | 'rejected';

export interface DialogMessage {
  id: string;
  tenant_id: string;
  chat_id: string;
  who: string | null;
  username: string | null;
  direction: 'in' | 'out';
  text: string | null;
  stage: string | null;
  created_at: string;
}

/** Сводка по диалогу для списка слева. */
export interface DialogSummary {
  chat_id: string;
  who: string | null;
  username: string | null;
  stage: string | null;
  last_text: string | null;
  last_at: string;
  last_direction: 'in' | 'out';
  msg_count: number;
}

/** Лейблы статусов воронки кандидатов (contacts.status). */
export const FUNNEL_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'new',       label: 'Новый',          color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'engaged',   label: 'Общается',       color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'wants',     label: 'Хочет работать', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'docs',      label: 'Документы',      color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'on_line',   label: 'На линии',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'rejected',  label: 'Отказ',          color: 'bg-red-50 text-red-600 border-red-200' },
];

/** Подсказки для отображения этапа диалога (stage в dialog_messages). */
export const STAGE_LABELS: Record<string, string> = {
  new: 'Новый',
  engaged: 'Общается',
  wants: 'Хочет работать',
  docs: 'Документы',
  on_line: 'На линии',
  rejected: 'Отказ',
};

export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700 border-gray-200',
  engaged: 'bg-blue-100 text-blue-700 border-blue-200',
  wants: 'bg-violet-100 text-violet-700 border-violet-200',
  docs: 'bg-amber-100 text-amber-800 border-amber-200',
  on_line: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};
