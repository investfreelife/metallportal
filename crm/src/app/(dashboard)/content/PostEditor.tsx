'use client';

import { useRef, useState } from 'react';
import {
  X,
  Upload,
  Trash2,
  CheckCircle2,
  Send,
  Clock,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import type { ContentPost, PostStatus } from '@/lib/content/types';
import { isPublishable } from '@/lib/content/types';
import { STATUS_LABELS, STATUS_COLORS } from './ContentClient';

interface Props {
  post: ContentPost;
  activeConnections: { id: string; platform: string; label: string; enabled: boolean }[];
  onClose: () => void;
  onChanged: (p: ContentPost) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}

/**
 * Боковая панель редактирования поста.
 * Жёсткое UI-правило: «Запланировать»/«Опубликовать» НЕДОСТУПНЫ
 *  пока нет photo_url И approved_final=true.
 */
export default function PostEditor({ post, activeConnections, onClose, onChanged, onDeleted }: Props) {
  const [draft, setDraft] = useState(post);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [scheduleAt, setScheduleAt] = useState<string>(post.scheduled_at?.slice(0, 16) ?? '');

  const status = (draft.status as PostStatus) ?? 'draft';
  const canPublish = isPublishable(draft);

  async function patch(body: Partial<ContentPost>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/content/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'patch failed');
      setDraft(j.post);
      await onChanged(j.post);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setBusy('upload');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/content/posts/${post.id}/photo`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'upload failed');
      setDraft(j.post);
      await onChanged(j.post);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(null);
    }
  }

  async function publishNow() {
    setBusy('publish');
    setError(null);
    try {
      const r = await fetch(`/api/content/posts/${post.id}/publish`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'publish failed');
      setDraft(j.post);
      await onChanged(j.post);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(null);
    }
  }

  async function schedule() {
    if (!scheduleAt) return setError('Выбери дату');
    const iso = new Date(scheduleAt).toISOString();
    await patch({ scheduled_at: iso, status: 'scheduled' as PostStatus });
  }

  async function reject() {
    await patch({ status: 'rejected' as PostStatus });
  }

  async function remove() {
    if (!confirm('Удалить пост?')) return;
    setBusy('delete');
    const r = await fetch(`/api/content/posts/${post.id}`, { method: 'DELETE' });
    setBusy(null);
    if (r.ok) await onDeleted();
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className={`inline-block text-[11px] px-2 py-0.5 rounded border ${STATUS_COLORS[status]}`}>
              {STATUS_LABELS[status]}
            </span>
            {draft.n != null && <span className="text-xs text-gray-500">#{draft.n}</span>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-4 mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Title ─────────────────────────────────────────────── */}
          <section className="px-4 pt-4 pb-3">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Заголовок</label>
            <input
              value={draft.title ?? ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onBlur={(e) => patch({ title: e.target.value })}
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
              placeholder="Без названия"
            />
          </section>

          {/* ── Body ──────────────────────────────────────────────── */}
          <section className="px-4 py-3">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Текст поста</label>
            <textarea
              value={draft.body ?? ''}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              onBlur={(e) => patch({ body: e.target.value })}
              rows={6}
              className="mt-1 w-full px-2.5 py-2 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y"
              placeholder="Текст поста (поддерживается HTML для Telegram: b/i/u/a/code/pre)"
            />
            <div className="mt-1 text-[10px] text-gray-400">{(draft.body ?? '').length} симв.</div>
          </section>

          {/* ── Photo ─────────────────────────────────────────────── */}
          <section className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Фото</label>
              {draft.photo_url && (
                <button
                  onClick={() => patch({ photo_url: null, status: 'awaiting_photo' as PostStatus })}
                  className="text-[10px] text-red-500 hover:text-red-700"
                  disabled={saving}
                >
                  Удалить
                </button>
              )}
            </div>

            {draft.photo_url ? (
              <div className="rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                <img src={draft.photo_url} alt="" className="w-full max-h-72 object-contain" />
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-3">
                <div className="flex items-center gap-1.5 text-amber-800 text-xs mb-1">
                  <ImageIcon size={12} />
                  <strong>ТЗ на фото</strong>
                </div>
                <textarea
                  value={draft.photo_tz ?? ''}
                  onChange={(e) => setDraft({ ...draft, photo_tz: e.target.value })}
                  onBlur={(e) => patch({ photo_tz: e.target.value })}
                  rows={3}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-amber-200 rounded focus:border-amber-400 focus:outline-none resize-y"
                  placeholder="Что должно быть на фото"
                />
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy === 'upload'}
              className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <Upload size={12} />
              {draft.photo_url ? 'Заменить фото' : 'Загрузить фото'}
            </button>
          </section>

          {/* ── Channel ───────────────────────────────────────────── */}
          <section className="px-4 py-3 border-t border-gray-100">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Канал публикации</label>
            <select
              value={draft.channel ?? ''}
              onChange={(e) => { setDraft({ ...draft, channel: e.target.value }); patch({ channel: e.target.value }); }}
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
          </section>

          {/* ── Approval ──────────────────────────────────────────── */}
          <section className="px-4 py-3 border-t border-gray-100">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2 block">Согласование</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!draft.approved_text}
                  onChange={(e) => patch({ approved_text: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Текст согласован</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!draft.approved_final}
                  onChange={(e) => patch({ approved_final: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700">Финал согласован</span>
              </label>
            </div>
          </section>

          {/* ── Schedule + Publish ────────────────────────────────── */}
          <section className="px-4 py-3 border-t border-gray-100">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Расписание</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={schedule}
                disabled={!canPublish || saving || !scheduleAt}
                title={!canPublish ? 'Нужно фото и approved_final' : ''}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Clock size={12} />
                Запланировать
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {canPublish ? 'Готов к публикации.' : 'Нужно фото И финальное согласование.'}
            </p>
          </section>

          {/* ── Note ──────────────────────────────────────────────── */}
          {draft.note && (
            <section className="px-4 py-3 border-t border-gray-100">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Заметка</label>
              <p className="mt-1 text-xs text-gray-700 break-words bg-gray-50 border border-gray-200 rounded p-2">{draft.note}</p>
            </section>
          )}
        </div>

        {/* ── Footer actions ──────────────────────────────────────── */}
        <footer className="border-t border-gray-200 px-4 py-3 flex items-center gap-2 bg-gray-50">
          <button
            onClick={publishNow}
            disabled={!canPublish || busy === 'publish'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!canPublish ? 'Нужно фото и approved_final' : 'Опубликовать сейчас'}
          >
            <Send size={12} />
            {busy === 'publish' ? 'Публикация…' : 'Опубликовать сейчас'}
          </button>
          <button
            onClick={reject}
            disabled={status === 'rejected' || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-100 disabled:opacity-40"
          >
            <X size={12} />
            Снять
          </button>
          <div className="flex-1" />
          <button
            onClick={remove}
            disabled={busy === 'delete'}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
            title="Удалить пост"
          >
            <Trash2 size={14} />
          </button>
        </footer>
      </aside>
    </div>
  );
}
