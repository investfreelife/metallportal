'use client';

import { useState } from 'react';
import { X, Calendar as CalIcon, AlertCircle } from 'lucide-react';

interface Props {
  /** Дата, которая будет подставлена в форму (клик по ячейке календаря). */
  initialDate: Date;
  activeConnections: { id: string; platform: string; label: string; enabled: boolean }[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

/**
 * Form-modal «Добавить пост» — открывается кликом по ячейке дня.
 * Подставляет clicked date в scheduled_at (default 10:00), пользователь правит
 * текст/ТЗ/канал и жмёт «Создать». Post сохраняется как draft (status=draft) —
 * scheduled_at заполнен но без approved_final публикация не пройдёт.
 *
 * Это поведение, как в Postiz: клик по дню → форма с предзаполненной датой.
 */
export default function CreatePostModal({ initialDate, activeConnections, onClose, onCreated }: Props) {
  // Default scheduled time = 10:00 на выбранный день. Если выбран сегодняшний
  // день и время уже больше 10:00 — сдвигаем на «сейчас + 1 час».
  const defaultDate = (() => {
    const d = new Date(initialDate);
    d.setHours(10, 0, 0, 0);
    const now = new Date();
    if (d < now) {
      const t = new Date(now);
      t.setHours(now.getHours() + 1, 0, 0, 0);
      return t;
    }
    return d;
  })();

  // datetime-local требует формата YYYY-MM-DDTHH:MM (локальное время, без TZ).
  const fmtLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photoTz, setPhotoTz] = useState('');
  const [channel, setChannel] = useState(activeConnections[0]?.label ?? '');
  const [scheduledAt, setScheduledAt] = useState<string>(fmtLocal(defaultDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const iso = new Date(scheduledAt).toISOString();
      const r = await fetch('/api/content/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          body: body.trim() || null,
          photo_tz: photoTz.trim() || null,
          channel: channel || null,
          scheduled_at: iso,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'create failed');
      await onCreated();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const humanDate = new Date(scheduledAt).toLocaleDateString('ru-RU', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalIcon size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Добавить пост</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={16} />
          </button>
        </header>

        <div className="px-4 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-xs text-blue-900">
            <span className="font-semibold">Дата публикации:</span> {humanDate}
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Дата и время</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Заголовок (опц.)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Короткое имя для админки"
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Текст поста</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Текст для публикации в канале (HTML для Telegram: b/i/u/a/code/pre)"
              className="mt-1 w-full px-2.5 py-2 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
            />
            <div className="text-[10px] text-gray-400 mt-1">{body.length} симв.</div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">ТЗ на фото (опц.)</label>
            <textarea
              value={photoTz}
              onChange={(e) => setPhotoTz(e.target.value)}
              rows={2}
              placeholder="Что должно быть на фото — нарисует/подберёт человек"
              className="mt-1 w-full px-2.5 py-1.5 text-xs border border-amber-200 bg-amber-50/40 rounded-md focus:border-amber-400 focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Канал</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
            >
              <option value="">— не выбран —</option>
              {activeConnections.map((c) => (
                <option key={c.id} value={c.label}>{c.label} · {c.platform}</option>
              ))}
              <option value="telegram">любая Telegram-связь</option>
              <option value="vk">любая VK-связь</option>
            </select>
            {activeConnections.length === 0 && (
              <p className="text-[10px] text-amber-700 mt-1">Нет активных связей. Добавь в /connections.</p>
            )}
          </div>

          <p className="text-[10px] text-gray-500">
            Пост создаётся как черновик (status=draft) с подставленной датой.
            Перевести в «scheduled» можно после согласования текста + загрузки фото в редакторе.
          </p>
        </div>

        <footer className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-md">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? 'Создание…' : 'Создать пост'}
          </button>
        </footer>
      </div>
    </div>
  );
}
