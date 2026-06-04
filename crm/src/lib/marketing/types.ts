// Типы маркетинговых кампаний CRM (campaigns + ad_variants + mailing_jobs).

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'done';
export type VariantLabel = 'A' | 'B' | 'C' | 'D' | 'E';
export type JobStatus = 'queued' | 'sent' | 'failed' | 'skipped';
export type JobTargetKind = 'group' | 'tg' | 'vk';

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  objective: string | null;
  audience: string | null;
  status: CampaignStatus | string | null;
  created_at: string;
}

export interface AdVariant {
  id: string;
  tenant_id: string;
  campaign_id: string;
  label: VariantLabel | string | null;
  text: string | null;
  photo_url: string | null;
  utm: string | null;
  status: string | null;
  sent_count: number | null;
  note: string | null;
  created_at: string;
}

export interface MailingJob {
  id: string;
  tenant_id: string;
  campaign_id: string;
  variant_id: string | null;
  target_kind: JobTargetKind | string | null;
  target: string | null;
  status: JobStatus | string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  result: string | null;
  created_at: string;
}

export const CAMPAIGN_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:  { label: 'Черновик',  color: 'bg-gray-100 text-gray-700 border-gray-200' },
  active: { label: 'Активна',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  paused: { label: 'Пауза',     color: 'bg-amber-100 text-amber-800 border-amber-200' },
  done:   { label: 'Завершена', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export const JOB_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued:  { label: 'В очереди', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  sent:    { label: 'Отправлено', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:  { label: 'Ошибка',   color: 'bg-red-50 text-red-600 border-red-200' },
  skipped: { label: 'Пропущено', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/**
 * Slugify для UTM-метки: латиница+цифры+дефис, всё остальное — '-'.
 * Например: «Найм водителей весна 2026» → «naym-voditeley-vesna-2026».
 */
const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugify(s: string | null | undefined): string {
  if (!s) return '';
  let out = '';
  for (const ch of s.toLowerCase()) {
    if (CYR_TO_LAT[ch] !== undefined) out += CYR_TO_LAT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += '-';
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/** UTM = ab-<slug-campaign>-<label> (lowercase). */
export function buildUtm(campaignName: string | null | undefined, label: string | null | undefined): string {
  const s = slugify(campaignName) || 'camp';
  const l = (label ?? 'a').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `ab-${s}-${l || 'a'}`;
}

/** Полная ссылка для канала рекрутинга Столицы (Sergey directive). */
export const STOLICA_BOT_BASE = 'https://t.me/stolica_dostavka_zbium_bot?start=';
export function buildStartLink(utm: string): string {
  return `${STOLICA_BOT_BASE}${encodeURIComponent(utm)}`;
}
