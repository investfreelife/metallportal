'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  X,
  Plus,
} from 'lucide-react';
import type { MarketingPost, MarketingPostStatus } from '@/lib/marketing-plan/types';
import { isPublishable } from '@/lib/marketing-plan/types';
import PostEditor from './PostEditor';
import CreatePostModal from './CreatePostModal';
import {
  fmtMsk,
  mskAddDays,
  mskAddMonths,
  mskDayKey,
  mskMonthYear,
  mskParts,
  mskShortDay,
  mskStartOfDay,
  mskStartOfMonth,
  mskStartOfWeek,
  mskWeekdayLongDate,
  isSameMskDay,
} from '@/lib/tz';

type ViewMode = 'calendar' | 'list';
type CalendarRange = 'month' | 'week' | 'day';

interface Props {
  initialPosts: MarketingPost[];
  activeConnections: { id: string; platform: string; label: string; enabled: boolean }[];
  tenantName: string | null;
}

const STATUS_LABELS: Partial<Record<MarketingPostStatus, string>> = {
  draft: 'Черновик',
  text_review: 'Текст на согласование',
  awaiting_photo: 'Ждёт фото',
  photo_review: 'Фото на согласование',
  ready: 'Готов',
  scheduled: 'Запланирован',
  published: 'Опубликован',
  rejected: 'Отклонён',
  error: 'Ошибка',
};

const STATUS_COLORS: Partial<Record<MarketingPostStatus, string>> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  text_review: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_photo: 'bg-amber-100 text-amber-800 border-amber-200',
  photo_review: 'bg-violet-100 text-violet-700 border-violet-200',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  scheduled: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  published: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  error: 'bg-red-100 text-red-700 border-red-200',
};

/**
 * ВСЕ даты в UI показываем в МСК через crm/src/lib/tz.ts, независимо от
 * таймзоны браузера. Хранение в БД — UTC; ввод datetime-local — МСК;
 * показ — МСК. Никаких `new Date().toLocale*` напрямую — иначе уедет
 * на TZ компа.
 */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return fmtMsk(iso, true);
}

export default function MarketingPlannerClient({ initialPosts, activeConnections, tenantName }: Props) {
  const [posts, setPosts] = useState<MarketingPost[]>(initialPosts);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarRange, setCalendarRange] = useState<CalendarRange>('week');
  // cursor — Date, указывающий на 00:00 МСК «выбранного» дня. Все сдвиги
  // и группировки идут от него в МСК-зоне через helper'ы lib/tz.
  const [cursor, setCursor] = useState<Date>(() => mskStartOfDay(new Date()));
  const [selectedPost, setSelectedPost] = useState<MarketingPost | null>(null);
  /**
   * Дата клика по ячейке — открывает CreatePostModal с подставленным scheduled_at.
   * Postiz-pattern: «click on a day → form opens with that date».
   */
  const [createOnDate, setCreateOnDate] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/marketing-plan/posts');
    const j = await r.json();
    if (j.posts) setPosts(j.posts);
  }, []);

  // ─── календарные ячейки для текущего range (всё в МСК) ──────────────
  const cells = useMemo(() => {
    if (calendarRange === 'day') return [cursor];
    if (calendarRange === 'week') {
      const start = mskStartOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => mskAddDays(start, i));
    }
    // month: сетка 6×7 от понедельника недели, в которой находится 1-е МСК.
    const first = mskStartOfMonth(cursor);
    const start = mskStartOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => mskAddDays(start, i));
  }, [cursor, calendarRange]);

  // Группировка постов по дню МСК — ключ «YYYY-MM-DD» в МСК.
  const postsByDay = useMemo(() => {
    const map = new Map<string, MarketingPost[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = mskDayKey(p.scheduled_at);
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return map;
  }, [posts]);

  const unscheduled = useMemo(() => posts.filter((p) => !p.scheduled_at), [posts]);

  function shift(delta: number) {
    if (calendarRange === 'day') setCursor(mskAddDays(cursor, delta));
    else if (calendarRange === 'week') setCursor(mskAddDays(cursor, 7 * delta));
    else setCursor(mskAddMonths(cursor, delta));
  }

  /**
   * Кнопка «Создать пост» в header — открывает форму с текущей датой (МСК).
   */
  function handleCreate() {
    setCreateOnDate(mskStartOfDay(new Date()));
  }

  const cursorLabel = useMemo(() => {
    if (calendarRange === 'day') return mskWeekdayLongDate(cursor);
    if (calendarRange === 'week') {
      const s = mskStartOfWeek(cursor);
      const e = mskAddDays(s, 6);
      return `${mskShortDay(s)} — ${mskShortDay(e)} ${mskParts(e).year}`;
    }
    return mskMonthYear(cursor);
  }, [cursor, calendarRange]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Контент</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Планировщик постов{tenantName ? ` · ${tenantName}` : ''} · Telegram + VK
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Видимая для пользователя метка зоны времени — ВСЕ даты показываются и вводятся в Москве. */}
          <span
            title="Все даты и время — в часовом поясе Москва (UTC+3). Не зависит от TZ браузера."
            className="flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md font-medium"
          >
            <Clock size={11} /> Время: Москва (МСК)
          </span>
          {activeConnections.length === 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
              ⚠️ Нет активных связей — добавь в /connections
            </span>
          )}
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            <Plus size={14} />
            Создать пост
          </button>
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600"><ChevronLeft size={16} /></button>
          <button onClick={() => setCursor(mskStartOfDay(new Date()))} className="px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md">Сегодня</button>
          <button onClick={() => shift(1)} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600"><ChevronRight size={16} /></button>
          <span className="ml-2 text-sm font-medium text-gray-900 capitalize">{cursorLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {(['day', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setCalendarRange(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded ${
                  calendarRange === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {r === 'day' ? 'День' : r === 'week' ? 'Неделя' : 'Месяц'}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              title="Календарь"
            >
              <Calendar size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              title="Список"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'calendar' ? (
          <CalendarView
            cells={cells}
            range={calendarRange}
            postsByDay={postsByDay}
            unscheduled={unscheduled}
            onSelect={setSelectedPost}
            onAddOnDate={setCreateOnDate}
          />
        ) : (
          <ListView posts={posts} onSelect={setSelectedPost} />
        )}
      </div>

      {selectedPost && (
        <PostEditor
          post={selectedPost}
          activeConnections={activeConnections}
          onClose={() => setSelectedPost(null)}
          onChanged={async (p) => {
            // optimistic update + refresh
            setSelectedPost(p);
            await refresh();
          }}
          onDeleted={async () => {
            setSelectedPost(null);
            await refresh();
          }}
        />
      )}

      {createOnDate && (
        <CreatePostModal
          initialDate={createOnDate}
          activeConnections={activeConnections}
          onClose={() => setCreateOnDate(null)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────
function CalendarView({
  cells,
  range,
  postsByDay,
  unscheduled,
  onSelect,
  onAddOnDate,
}: {
  cells: Date[];
  range: CalendarRange;
  postsByDay: Map<string, MarketingPost[]>;
  unscheduled: MarketingPost[];
  onSelect: (p: MarketingPost) => void;
  /** Клик по ячейке дня → открыть форму с подставленной датой (Postiz-pattern). */
  onAddOnDate: (d: Date) => void;
}) {
  const today = new Date();
  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  if (range === 'day') {
    const k = mskDayKey(cells[0]);
    const dayPosts = postsByDay.get(k) ?? [];
    return (
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <UnscheduledColumn posts={unscheduled} onSelect={onSelect} />
        <div
          onClick={() => onAddOnDate(cells[0])}
          className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 capitalize">
              {mskWeekdayLongDate(cells[0])}
            </h3>
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 font-medium">
              + добавить пост
            </span>
          </div>
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            {dayPosts.length === 0 && <p className="text-xs text-gray-400">Постов на этот день нет — кликни в любое место, чтобы добавить.</p>}
            {dayPosts.map((p) => <PostPill key={p.id} post={p} onClick={() => onSelect(p)} />)}
          </div>
        </div>
      </div>
    );
  }

  const isMonth = range === 'month';
  // для month-view определяем "текущий месяц" по середине сетки (это всегда
  // принадлежит запрошенному месяцу — даже если 1-е попало на чт).
  const monthAnchorMonth = isMonth ? mskParts(cells[Math.floor(cells.length / 2)]).month : null;

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4">
      <UnscheduledColumn posts={unscheduled} onSelect={onSelect} />
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Заголовок дней недели — для week-view показываем числа дат (МСК). */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {(range === 'week' ? cells : Array.from({ length: 7 }, () => null)).map((c, i) => (
            <div key={i} className="px-2 py-2 text-center">
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                {dayLabels[i]}
              </div>
              {range === 'week' && c && (
                <div className={`text-xs font-semibold mt-0.5 ${isSameMskDay(c, today) ? 'text-blue-600' : 'text-gray-700'}`}>
                  {mskShortDay(c)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const k = mskDayKey(c);
            const dayPosts = postsByDay.get(k) ?? [];
            const isToday = isSameMskDay(c, today);
            const isCurrentMonth = !isMonth || mskParts(c).month === monthAnchorMonth;
            const dayNumber = mskParts(c).day;
            return (
              <div
                key={i}
                onClick={() => onAddOnDate(c)}
                className={`min-h-[100px] border-r border-b border-gray-100 p-1.5 cursor-pointer hover:bg-blue-50/30 hover:border-blue-200 transition-colors group ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                }`}
                title="Кликнуть — добавить пост на этот день"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className={`text-[11px] ${isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                    {dayNumber}
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-600 font-bold leading-none">+</span>
                </div>
                <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  {dayPosts.slice(0, 3).map((p) => (
                    <PostPill key={p.id} post={p} onClick={() => onSelect(p)} compact />
                  ))}
                  {dayPosts.length > 3 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(dayPosts[3]); }}
                      className="text-[10px] text-gray-500 hover:text-blue-600"
                    >
                      +{dayPosts.length - 3} ещё
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UnscheduledColumn({ posts, onSelect }: { posts: MarketingPost[]; onSelect: (p: MarketingPost) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 max-h-[calc(100vh-220px)] overflow-y-auto">
      <h3 className="text-xs font-semibold text-gray-700 mb-2 sticky top-0 bg-white pb-1">
        Черновики и ожидание ({posts.length})
      </h3>
      <div className="space-y-1.5">
        {posts.length === 0 && <p className="text-xs text-gray-400">Нет неназначенных постов.</p>}
        {posts.map((p) => <PostPill key={p.id} post={p} onClick={() => onSelect(p)} />)}
      </div>
    </div>
  );
}

function PostPill({ post, onClick, compact }: { post: MarketingPost; onClick: () => void; compact?: boolean }) {
  const status = (post.status as MarketingPostStatus) ?? 'draft';
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left border rounded px-1.5 py-1 ${color} hover:shadow-sm transition-all`}
    >
      <div className={`font-medium truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {post.label || post.text?.slice(0, 40) || 'Без названия'}
      </div>
      {!compact && (
        <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-80">
          {post.scheduled_at && <><Clock size={10} />{fmtDate(post.scheduled_at)}</>}
          {!post.photo_url && <ImageIcon size={10} />}
        </div>
      )}
    </button>
  );
}

// ─── List view ────────────────────────────────────────────────────────
function ListView({ posts, onSelect }: { posts: MarketingPost[]; onSelect: (p: MarketingPost) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-[11px] font-medium text-gray-600 uppercase tracking-wide">
            <th className="px-3 py-2 w-10">#</th>
            <th className="px-3 py-2">Пост</th>
            <th className="px-3 py-2 w-44">Статус</th>
            <th className="px-3 py-2 w-32">Канал</th>
            <th className="px-3 py-2 w-40">Расписание</th>
            <th className="px-3 py-2 w-20 text-center">Фото</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {posts.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">Постов пока нет.</td></tr>
          )}
          {posts.map((p) => {
            const status = (p.status as MarketingPostStatus) ?? 'draft';
            return (
              <tr key={p.id} onClick={() => onSelect(p)} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-3 py-2 text-xs text-gray-500">{p.n ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900 text-sm truncate max-w-md">{p.label || p.text?.slice(0, 60) || 'Без названия'}</div>
                  {p.text && p.label && <div className="text-xs text-gray-500 truncate max-w-md">{p.text.slice(0, 100)}</div>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block text-[11px] px-2 py-0.5 rounded border ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  {isPublishable(p) && status !== 'published' && (
                    <span className="ml-1 text-[10px] text-emerald-600">✓ готов</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">{p.channel || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{fmtDate(p.scheduled_at) || '—'}</td>
                <td className="px-3 py-2 text-center">
                  {p.photo_url ? <CheckCircle2 size={14} className="text-green-600 inline" /> : <X size={14} className="text-gray-300 inline" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// helpers re-exported
export { STATUS_LABELS, STATUS_COLORS };
