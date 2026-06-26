'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeFetchJson } from '@/lib/safe-fetch';
import {
  CalendarClock,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertCircle,
  Users,
} from 'lucide-react';

const TZ = 'Europe/Moscow';

interface PlanItem {
  id: string;
  channel: string;
  target: string | null;
  target_name: string | null;
  members: number | null;
  text: string | null;
  variant: number | null;
  scheduled_at: string | null;
  status: string;
  result_link: string | null;
  posted_at: string | null;
  joined: boolean | null;
  link: string | null;
}

interface ChannelSummary {
  planned: number;
  posted: number;
  failed: number;
}

interface PlanResponse {
  items: PlanItem[];
  summary: { telegram: ChannelSummary; vk: ChannelSummary };
}

type Channel = 'telegram' | 'vk';

const EMPTY_SUMMARY: ChannelSummary = { planned: 0, posted: 0, failed: 0 };

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU');
}

/** Стабильный ключ дня по МСК «YYYY-MM-DD» (для группировки). */
function mskDayKey(iso: string): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso)).reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}-${p.month}-${p.day}`;
}

/** Заголовок дня по МСК «5 июня, чт». */
function mskDayLabel(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  }).format(new Date(iso));
}

/** Только время по МСК «07:00». */
function mskTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function SeedPlanClient() {
  const [resp, setResp] = useState<PlanResponse | null>(null);
  const [channel, setChannel] = useState<Channel>('telegram');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Локально удалённые id (оптимистично убираем из списка).
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const j = await safeFetchJson<PlanResponse>('/api/recruit/seed-plan');
      setResp(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function removeRow(item: PlanItem) {
    if (!confirm('Удалить эту строку плана?\n(локально, опубликованный пост не тронется.)')) return;
    try {
      await safeFetchJson(`/api/recruit/seed-plan/${item.id}`, { method: 'DELETE' });
      setRemoved((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const summary: ChannelSummary = resp?.summary?.[channel] ?? EMPTY_SUMMARY;

  // Список активной вкладки + группировка по дням (МСК).
  const groups = useMemo(() => {
    const items = (resp?.items ?? []).filter(
      (i) => i.channel === channel && !removed.has(i.id) && i.scheduled_at,
    );
    const byDay = new Map<string, PlanItem[]>();
    for (const it of items) {
      const key = mskDayKey(it.scheduled_at as string);
      const arr = byDay.get(key);
      if (arr) arr.push(it);
      else byDay.set(key, [it]);
    }
    // Map сохраняет порядок вставки; items уже отсортированы по scheduled_at.
    return Array.from(byDay.entries()).map(([key, list]) => ({
      key,
      label: mskDayLabel(list[0].scheduled_at as string),
      items: list,
    }));
  }, [resp, channel, removed]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock size={20} className="text-gray-600" />
            📅 Посев-план
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Когда и куда машина постит. Время МСК.
          </p>
        </div>
        <button
          onClick={() => reload()}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Обновить
        </button>
      </header>

      {/* ── Вкладки каналов ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100">
        <ChannelTab
          active={channel === 'telegram'}
          onClick={() => setChannel('telegram')}
          label="Telegram"
        />
        <ChannelTab
          active={channel === 'vk'}
          onClick={() => setChannel('vk')}
          label="VK"
        />
      </div>

      {/* ── Сводка по активной вкладке ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-white border-b border-gray-100">
        <TotalCard label="Запланировано" value={fmtNum(summary.planned)} />
        <TotalCard label="Опубликовано" value={fmtNum(summary.posted)} />
        <TotalCard label="Ошибок" value={fmtNum(summary.failed)} />
      </div>

      {/* ── Плашка-пояснение для VK ─────────────────────────────────── */}
      {channel === 'vk' && (
        <div className="mx-6 mt-3 mb-1 text-xs bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-gray-700 leading-relaxed">
          VK не разрешает постить в чужие группы — поэтому посев в VK идёт в наше
          сообщество. Охват чужих VK-аудиторий — только платный таргет.
        </div>
      )}

      {error && (
        <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Список по дням ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-12">Загрузка…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">План пуст.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="text-xs font-semibold text-gray-700 mb-2 sticky top-0 bg-gray-50 py-1">
                  {g.label}
                </div>
                <div className="space-y-2">
                  {g.items.map((it) => (
                    <PlanRow key={it.id} item={it} channel={channel} onRemove={() => removeRow(it)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Строка плана ──────────────────────────────────────────────────────
function PlanRow({
  item,
  channel,
  onRemove,
}: {
  item: PlanItem;
  channel: Channel;
  onRemove: () => void;
}) {
  const time = item.scheduled_at ? mskTime(item.scheduled_at) : '—';
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-start gap-3">
      <div className="text-xs font-semibold text-gray-900 tabular-nums w-12 flex-shrink-0 pt-0.5">
        {time}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Цель */}
          {channel === 'telegram' && item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1 text-xs font-medium"
              title="Открыть в Telegram"
            >
              <span className="truncate max-w-[220px]">{item.target_name || item.target || 'группа'}</span>
              <ExternalLink size={11} className="flex-shrink-0 opacity-50" />
            </a>
          ) : (
            <span className="text-xs font-medium text-gray-900 truncate max-w-[260px]">
              {item.target_name || item.target || 'наше сообщество'}
            </span>
          )}

          {channel === 'telegram' && item.members != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 tabular-nums">
              <Users size={10} />
              {fmtNum(item.members)}
            </span>
          )}

          {/* Бейдж варианта */}
          {item.variant != null && (
            <span className="inline-block text-[10px] px-2 py-0.5 border rounded bg-indigo-100 text-indigo-700 border-indigo-200">
              Вариант {item.variant}
            </span>
          )}

          {/* Бейдж статуса */}
          <StatusBadge status={item.status} resultLink={item.result_link} />
        </div>

        {/* Превью текста */}
        {item.text && (
          <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-snug">
            {item.text}
          </p>
        )}
      </div>

      <button
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
        title="Удалить из плана"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function StatusBadge({ status, resultLink }: { status: string; resultLink: string | null }) {
  if (status === 'posted') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 border rounded bg-emerald-100 text-emerald-700 border-emerald-200">
        ✓ опубликовано
        {resultLink && (
          <a
            href={resultLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center hover:underline"
            title="Открыть пост"
          >
            <ExternalLink size={9} className="opacity-70" />
          </a>
        )}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-block text-[10px] px-2 py-0.5 border rounded bg-red-100 text-red-700 border-red-200">
        ✗ ошибка
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-block text-[10px] px-2 py-0.5 border rounded bg-gray-100 text-gray-600 border-gray-200">
        пропущено
      </span>
    );
  }
  // planned (и любой неизвестный) — серый «⏳ запланировано»
  return (
    <span className="inline-block text-[10px] px-2 py-0.5 border rounded bg-gray-100 text-gray-600 border-gray-200">
      ⏳ запланировано
    </span>
  );
}

function ChannelTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-xs font-medium border rounded-md transition-colors ${
        active
          ? 'bg-gray-800 text-white border-gray-800'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function TotalCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
