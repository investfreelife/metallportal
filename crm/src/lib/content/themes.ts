// Типы и helper'ы тем контент-плана (content_themes).

export type ThemeStatus = 'idea' | 'drafted' | 'rejected';

export interface ContentTheme {
  id: string;
  tenant_id: string;
  rubric: string | null;
  title: string | null;
  idea: string | null;
  status: ThemeStatus | null;
  priority: number | null;
  post_id: string | null;
  created_at: string;
}

export const THEME_STATUS_LABELS: Record<ThemeStatus, string> = {
  idea: 'Идея',
  drafted: 'В черновике',
  rejected: 'Отклонена',
};

export const THEME_STATUS_COLORS: Record<ThemeStatus, string> = {
  idea: 'bg-gray-100 text-gray-700 border-gray-200',
  drafted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

/**
 * Сгруппировать темы по rubric. Возвращает массив [rubric, themes[]] —
 * чтобы UI стабильно сохранял порядок (rubric ASC из API).
 */
export function groupByRubric(themes: ContentTheme[]): [string, ContentTheme[]][] {
  const map = new Map<string, ContentTheme[]>();
  for (const t of themes) {
    const key = t.rubric || 'Без рубрики';
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}
