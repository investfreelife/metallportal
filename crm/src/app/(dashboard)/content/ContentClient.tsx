'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Upload,
  Edit3,
  Trash2,
  Plus,
} from 'lucide-react';
import type { ContentPost, PostStatus } from '@/lib/content/types';
import { isPublishable } from '@/lib/content/types';
import PostEditor from './PostEditor';

type ViewMode = 'calendar' | 'list';
type CalendarRange = 'month' | 'week' | 'day';

interface Props {
  initialPosts: ContentPost[];
  activeConnections: { id: string; platform: string; label: string; enabled: boolean }[];
  tenantName: string | null;
}

const STATUS_LABELS: Record<PostStatus, string> = {
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

const STATUS_COLORS: Record<PostStatus, string> = {
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

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // ISO неделя пн-вс
  const out = new Date(d);
  out.setDate(d.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ContentClient({ initialPosts, activeConnections, tenantName }: Props) {
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarRange, setCalendarRange] = useState<CalendarRange>('week');
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/content/posts');
    const j = await r.json();
    if (j.posts) setPosts(j.posts);
  }, []);

  // ─── календарные ячейки для текущего range ──────────────────────────
  const cells = useMemo(() => {
    if (calendarRange === 'day') return [cursor];
    if (calendarRange === 'week') {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    // month
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i)); // 6 недель
  }, [cursor, calendarRange]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ContentPost[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return map;
  }, [posts]);

  const unscheduled = useMemo(() => posts.filter((p) => !p.scheduled_at), [posts]);

  function shift(delta: number) {
    const d = new Date(cursor);
    if (calendarRange === 'day') d.setDate(d.getDate() + delta);
    else if (calendarRange === 'week') d.setDate(d.getDate() + 7 * delta);
    else d.setMonth(d.getMonth() + delta);
    setCursor(d);
  }

  async function handleCreate() {
    setIsCreating(true);
    const r = await fetch('/api/content/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Новый пост', status: 'draft' }) });
    const j = await r.json();
    setIsCreating(false);
    if (j.post) {
      await refresh();
      setSelectedPost(j.post);
    }
  }

  const cursorLabel = useMemo(() => {
    if (calendarRange === 'day') return cursor.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
    if (calendarRange === 'week') {
      const s = startOfWeek(cursor);
      const e = addDays(s, 6);
      return `${s.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} — ${e.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    return cursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
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
          {activeConnections.length === 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
              ⚠️ Нет активных связей — добавь в /connections
            </span>
          )}
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
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
          <button onClick={() => setCursor(new Date())} className="px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md">Сегодня</button>
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
}: {
  cells: Date[];
  range: CalendarRange;
  postsByDay: Map<string, ContentPost[]>;
  unscheduled: ContentPost[];
  onSelect: (p: ContentPost) => void;
}) {
  const today = new Date();
  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  if (range === 'day') {
    const k = `${cells[0].getFullYear()}-${cells[0].getMonth()}-${cells[0].getDate()}`;
    const dayPosts = postsByDay.get(k) ?? [];
    return (
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <UnscheduledColumn posts={unscheduled} onSelect={onSelect} />
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {cells[0].toLocaleDateString('ru-RU', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {dayPosts.length === 0 && <p className="text-xs text-gray-400">Постов на этот день нет.</p>}
            {dayPosts.map((p) => <PostPill key={p.id} post={p} onClick={() => onSelect(p)} />)}
          </div>
        </div>
      </div>
    );
  }

  const isMonth = range === 'month';
  const gridCols = 7;

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4">
      <UnscheduledColumn posts={unscheduled} onSelect={onSelect} />
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className={`grid grid-cols-7 bg-gray-50 border-b border-gray-200`}>
          {dayLabels.map((d) => (
            <div key={d} className="px-2 py-2 text-[11px] font-medium text-gray-600 text-center uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-${gridCols}`}>
          {cells.map((c, i) => {
            const k = `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}`;
            const dayPosts = postsByDay.get(k) ?? [];
            const isToday = sameDay(c, today);
            const isCurrentMonth = !isMonth || c.getMonth() === cells[Math.floor(cells.length / 2)].getMonth();
            return (
              <div
                key={i}
                className={`min-h-[100px] border-r border-b border-gray-100 p-1.5 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <div className={`text-[11px] mb-1 ${isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                  {c.getDate()}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 3).map((p) => (
                    <PostPill key={p.id} post={p} onClick={() => onSelect(p)} compact />
                  ))}
                  {dayPosts.length > 3 && (
                    <button
                      onClick={() => onSelect(dayPosts[3])}
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

function UnscheduledColumn({ posts, onSelect }: { posts: ContentPost[]; onSelect: (p: ContentPost) => void }) {
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

function PostPill({ post, onClick, compact }: { post: ContentPost; onClick: () => void; compact?: boolean }) {
  const status = (post.status as PostStatus) ?? 'draft';
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left border rounded px-1.5 py-1 ${color} hover:shadow-sm transition-all`}
    >
      <div className={`font-medium truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {post.title || post.body?.slice(0, 40) || 'Без названия'}
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
function ListView({ posts, onSelect }: { posts: ContentPost[]; onSelect: (p: ContentPost) => void }) {
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
            const status = (p.status as PostStatus) ?? 'draft';
            return (
              <tr key={p.id} onClick={() => onSelect(p)} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-3 py-2 text-xs text-gray-500">{p.n ?? '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-900 text-sm truncate max-w-md">{p.title || p.body?.slice(0, 60) || 'Без названия'}</div>
                  {p.body && p.title && <div className="text-xs text-gray-500 truncate max-w-md">{p.body.slice(0, 100)}</div>}
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
