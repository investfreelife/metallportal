'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Trash2,
  CheckCircle2,
  Send,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  History,
  Pencil,
  Camera,
  Dice5,
  Check,
  ArrowUp,
  ArrowDown,
  Layers,
  Save,
  Lock,
} from 'lucide-react';
import type { MarketingPost, MarketingPostStatus, FeedbackEntry, RedoFlag, PhotoOption } from '@/lib/marketing-plan/types';
import { isPublishable, CAROUSEL_LIMIT } from '@/lib/marketing-plan/types';
import { STATUS_LABELS, STATUS_COLORS } from './MarketingPlannerClient';
import { toMskInputValue, mskInputToUTC, fmtMsk } from '@/lib/tz';

const POLL_MS = 10_000;

interface Props {
  post: MarketingPost;
  activeConnections: { id: string; platform: string; label: string; enabled: boolean }[];
  onClose: () => void;
  onChanged: (p: MarketingPost) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}

/**
 * Боковая панель редактирования поста.
 * Жёсткое UI-правило: «Запланировать»/«Опубликовать» НЕДОСТУПНЫ
 *  пока нет photo_url И approved_final=true.
 */
export default function PostEditor({ post, onClose, onChanged, onDeleted }: Props) {
  const [draft, setDraft] = useState<MarketingPost>(post);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // datetime-local value — в МОСКОВСКОМ настенном времени, не локальном TZ.
  const [scheduleAt, setScheduleAt] = useState<string>(
    post.scheduled_at ? toMskInputValue(post.scheduled_at) : ''
  );

  const status = (draft.status as MarketingPostStatus) ?? 'draft';
  const canPublish = isPublishable(draft);
  const redo: RedoFlag = (draft.redo ?? {}) as RedoFlag;
  const redoingText = !!redo.text;
  const redoingPhoto = !!redo.photo;
  const generatingVariants = !!redo.variants;
  const photoOptions: PhotoOption[] = Array.isArray(draft.photo_options) ? draft.photo_options : [];

  // ── Карусель ───────────────────────────────────────────────────────
  // Локальный state: список URL'ов карусели (порядок задан пользователем).
  // Инициализация: draft.photos если есть, иначе [photo_url] если есть, иначе [].
  const initialCarousel = (() => {
    if (Array.isArray(draft.photos) && draft.photos.length > 0) {
      return draft.photos.filter((u) => typeof u === 'string' && u);
    }
    return draft.photo_url ? [draft.photo_url] : [];
  })();
  const [carousel, setCarousel] = useState<string[]>(initialCarousel);
  // Помним последний remote-snapshot — чтобы понимать, трогал юзер или нет.
  const lastRemoteRef = useRef<string>(JSON.stringify(initialCarousel));
  // Синхроним carousel когда воркер обновляет draft.photos извне (polling).
  // ВАЖНО (фикс 2026-06-06): НЕ перезаписываем локальный выбор юзера.
  // Подхватываем remote ТОЛЬКО если юзер не менял carousel с прошлой синхр.
  useEffect(() => {
    const remote = Array.isArray(draft.photos)
      ? draft.photos.filter((u) => typeof u === 'string' && u)
      : null;
    if (!remote) return;
    const remoteJson = JSON.stringify(remote);
    const localJson = JSON.stringify(carousel);
    if (remoteJson === localJson) { lastRemoteRef.current = remoteJson; return; }
    if (localJson === lastRemoteRef.current) {
      setCarousel(remote);
      lastRemoteRef.current = remoteJson;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.photos]);

  const isInCarousel = (url: string) => carousel.includes(url);
  const carouselDirty = JSON.stringify(carousel) !== JSON.stringify(initialCarousel);

  function toggleCarousel(url: string) {
    if (!url) return;
    setCarousel((c) => {
      if (c.includes(url)) return c.filter((u) => u !== url);
      if (c.length >= CAROUSEL_LIMIT) return c;
      return [...c, url];
    });
  }
  function moveCarousel(i: number, dir: -1 | 1) {
    setCarousel((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.length) return c;
      const next = c.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removeFromCarousel(i: number) {
    setCarousel((c) => c.filter((_, idx) => idx !== i));
  }
  async function saveCarousel() {
    setBusy('carousel:save');
    setError(null);
    try {
      await patch({
        photos: carousel,
        // photo_url остаётся «обложкой» = первое в карусели (для backward-compat).
        photo_url: carousel[0] ?? null,
      });
    } finally {
      setBusy(null);
    }
  }

  // ── Поллинг пока хотя бы один redo-флаг активен ────────────────────
  // Воркер сам переделает body / photo_url / сгенерит photo_options
  // и сбросит соответствующий флаг. Фронт ждёт.
  useEffect(() => {
    if (!redoingText && !redoingPhoto && !generatingVariants) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/marketing-plan/posts?id=${post.id}`, { cache: 'no-store' });
        // Дёшёво: список + filter по id (отдельного GET роута пока нет).
        // Если возвращает 200 и есть наш пост — обновим draft.
        const j = await r.json().catch(() => null);
        const updated = (j?.posts ?? []).find((p: MarketingPost) => p.id === post.id);
        if (updated) {
          setDraft(updated);
          if (updated.scheduled_at) setScheduleAt(toMskInputValue(updated.scheduled_at));
        }
      } catch {
        // тихо игнорим — следующий тик попробует
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [redoingText, redoingPhoto, generatingVariants, post.id]);

  async function patch(body: Partial<MarketingPost>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/marketing-plan/posts/${post.id}`, {
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

  /**
   * Upload фото в Storage + добавить в photo_options. Если cover=true —
   * сделать обложкой (photo_url) сразу. По умолчанию — только вариант,
   * пользователь выбирает обложку в галерее.
   */
  async function uploadPhoto(file: File, cover = false) {
    setBusy('upload');
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `/api/marketing-plan/posts/${post.id}/photo${cover ? '?cover=1' : ''}`;
      const r = await fetch(url, { method: 'POST', body: fd });
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

  /** Sergey directive 2026-06-06: «загружать сразу несколько файлов».
   *  Multi-upload по списку с прогрессом N/M. Падения одного не валят
   *  остальные — копим errors[] и показываем баннером. */
  async function uploadMany(files: File[] | FileList) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setError(null);
    const errors: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setBusy(`upload:${i + 1}/${list.length}`);
      try {
        const fd = new FormData();
        fd.append('file', f);
        const r = await fetch(`/api/marketing-plan/posts/${post.id}/photo`, { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || 'upload failed');
        setDraft(j.post);
        await onChanged(j.post);
      } catch (e: any) {
        errors.push(`${f.name}: ${String(e.message || e)}`);
      }
    }
    if (errors.length) setError(`Ошибки загрузки:\n${errors.join('\n')}`);
    setBusy(null);
  }

  async function publishNow() {
    setBusy('publish');
    setError(null);
    try {
      const r = await fetch(`/api/marketing-plan/posts/${post.id}/publish`, { method: 'POST' });
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
    // scheduleAt — это МСК настенное время; конвертим в UTC ISO для БД.
    const iso = mskInputToUTC(scheduleAt);
    await patch({ scheduled_at: iso, status: 'scheduled' as MarketingPostStatus });
  }

  async function reject() {
    await patch({ status: 'rejected' as MarketingPostStatus });
  }

  /**
   * Запросить у воркера сгенерить набор вариантов фото (бесплатный Flux на
   * Cloudflare и т.п.). Воркер положит результат в photo_options[] и
   * сбросит redo.variants=false. Фронт уже поллит и подхватит галерею.
   */
  async function requestVariants() {
    setBusy('variants');
    setError(null);
    const newRedo: RedoFlag = { ...(draft.redo as RedoFlag | null ?? {}), variants: true };
    try {
      const r = await fetch(`/api/marketing-plan/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redo: newRedo }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'variants failed');
      setDraft(j.post);
      await onChanged(j.post);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Выбрать вариант из photo_options — переставить photo_url, статус
   * вернуть в photo_review (ожидает финального согласования).
   */
  async function pickVariant(opt: PhotoOption) {
    if (!opt?.url) return;
    setBusy(`pick:${opt.url}`);
    setError(null);
    try {
      const r = await fetch(`/api/marketing-plan/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: opt.url, status: 'photo_review' as MarketingPostStatus }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'pick failed');
      setDraft(j.post);
      await onChanged(j.post);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Поставить redo-флаг для воркера. Сохраняет comment + redo + status='redo'.
   * Воркер сам:
   *  • переделает body (если target='text') или photo_url (target='photo')
   *  • запишет правку в feedback[]
   *  • сбросит redo.<target>=false
   *  • поставит status обратно (text_review / photo_review)
   */
  async function requestRedo(target: 'text' | 'photo', comment: string) {
    if (!comment.trim()) {
      setError(`Опиши, что не так с ${target === 'text' ? 'текстом' : 'фото'} — короткой фразы достаточно.`);
      return;
    }
    setBusy(`redo:${target}`);
    setError(null);
    const newRedo: RedoFlag = { ...(draft.redo as RedoFlag | null ?? {}), [target]: true };
    const body: Partial<MarketingPost> = {
      redo: newRedo,
      status: 'redo' as MarketingPostStatus,
    };
    if (target === 'text') body.comment_text = comment.trim();
    else body.comment_photo = comment.trim();
    try {
      const r = await fetch(`/api/marketing-plan/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'redo failed');
      setDraft(j.post);
      await onChanged(j.post);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm('Удалить пост?')) return;
    setBusy('delete');
    const r = await fetch(`/api/marketing-plan/posts/${post.id}`, { method: 'DELETE' });
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
          {/* 🔒 Согласовано человеком — автоматика не двигает дату/фото/текст. */}
          {status === 'approved' && (
            <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-3 py-2">
              <Lock size={14} className="flex-shrink-0 mt-0.5" />
              <span>🔒 Согласовано человеком — меняет только человек. Автоматика не двигает дату/фото/текст.</span>
            </div>
          )}
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
              value={draft.label ?? ''}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              onBlur={(e) => patch({ label: e.target.value })}
              className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none"
              placeholder="Без названия"
            />
          </section>

          {/* ── Body + комментарий + переделать ───────────────────── */}
          <section className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Pencil size={11} />
                Текст поста
              </label>
              {draft.approved_text && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                  <CheckCircle2 size={10} /> Согласован
                </span>
              )}
            </div>
            <textarea
              value={draft.text ?? ''}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              onBlur={(e) => patch({ text: e.target.value })}
              rows={6}
              disabled={redoingText}
              className={`mt-1 w-full px-2.5 py-2 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none resize-y ${
                redoingText ? 'bg-violet-50 border-violet-200 opacity-60' : ''
              }`}
              placeholder="Текст поста (поддерживается HTML для Telegram: b/i/u/a/code/pre)"
            />
            <div className="mt-1 text-[10px] text-gray-400">{(draft.text ?? '').length} симв.</div>

            {redoingText ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-2.5 py-1.5">
                <RefreshCw size={12} className="animate-spin" />
                <span>
                  🔄 Воркер переделывает текст… {draft.comment_text && <em className="text-violet-600">(твой коммент: {draft.comment_text})</em>}
                </span>
              </div>
            ) : (
              <RedoBlock
                kind="text"
                placeholder="Что не так с текстом? «Сократи в 2 раза», «убери штампы», «сделай теплее»…"
                busyKey={busy}
                onSubmit={(c) => requestRedo('text', c)}
              />
            )}
          </section>

          {/* ── Photo + комментарий + переделать ──────────────────── */}
          <section className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Camera size={11} />
                Фото
              </label>
              <div className="flex items-center gap-2">
                {draft.approved_final && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                    <CheckCircle2 size={10} /> Финал ок
                  </span>
                )}
                {draft.photo_url && !redoingPhoto && (
                  <button
                    onClick={() => patch({ photo_url: null, status: 'awaiting_photo' as MarketingPostStatus })}
                    className="text-[10px] text-red-500 hover:text-red-700"
                    disabled={saving}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>

            {redoingPhoto ? (
              <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-xs text-violet-700 flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin flex-shrink-0" />
                <span>
                  🔄 Воркер генерирует новое фото… {draft.comment_photo && <em className="text-violet-600">(твой коммент: {draft.comment_photo})</em>}
                </span>
              </div>
            ) : draft.photo_url ? (
              <div className="rounded-md overflow-hidden border border-gray-200 bg-gray-50 relative">
                <img src={draft.photo_url} alt="" className="w-full max-h-72 object-contain" />
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/90 text-gray-700 border border-gray-200 backdrop-blur-sm">
                  <ImageIcon size={10} /> текущее
                </span>
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
              accept="image/png,image/jpeg,image/webp,image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length) uploadMany(files);
                if (fileRef.current) fileRef.current.value = '';
              }}
            />
            {/* Drag&drop / клик зона */}
            <UploadDropArea
              busy={!!busy && busy.startsWith('upload')}
              busyLabel={busy && busy.startsWith('upload:') ? busy.replace('upload:', '') : null}
              disabled={redoingPhoto}
              onPick={() => fileRef.current?.click()}
              onFiles={(files) => uploadMany(files)}
            />
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              {/* «Дать варианты» — воркер сгенерит 3 бесплатных Flux. */}
              <button
                onClick={requestVariants}
                disabled={generatingVariants || busy === 'variants'}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-40"
                title="Воркер сгенерит 3 бесплатных варианта (Flux) и положит в галерею"
              >
                {generatingVariants ? <RefreshCw size={11} className="animate-spin" /> : <Dice5 size={11} />}
                {generatingVariants ? 'Воркер генерит…' : '🎲 Дать варианты'}
              </button>
            </div>

            {/* ── Галерея вариантов ─────────────────────────────── */}
            {(photoOptions.length > 0 || generatingVariants) && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <ImageIcon size={11} />
                    Варианты ({photoOptions.length})
                  </label>
                  {photoOptions.length > 0 && !generatingVariants && (
                    <button
                      onClick={() => patch({ photo_options: [] })}
                      className="text-[10px] text-gray-500 hover:text-red-600"
                      disabled={saving}
                    >
                      Очистить
                    </button>
                  )}
                </div>
                {generatingVariants && photoOptions.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 text-xs text-amber-800 flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin" />
                    Воркер генерит набор кандидатов…
                  </div>
                )}
                {photoOptions.length > 0 && (
                  <>
                    <p className="text-[10px] text-gray-500 mb-1.5">
                      Можно выбрать несколько (фото + инфографика и т.п.) — Telegram отправит каруселью.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {photoOptions.map((opt, i) => {
                        const isCurrent = !!opt?.url && opt.url === draft.photo_url;
                        const inCarousel = !!opt?.url && isInCarousel(opt.url);
                        const carouselIdx = opt?.url ? carousel.indexOf(opt.url) : -1;
                        const picking = busy === `pick:${opt.url}`;
                        const cost = opt?.cost == null ? null
                          : typeof opt.cost === 'number'
                            ? `$${opt.cost.toFixed(opt.cost < 0.01 ? 4 : 2)}`
                            : String(opt.cost);
                        const kindLabel = opt?.kind === 'info' ? 'инфографика'
                          : opt?.kind === 'cover' ? 'обложка'
                          : opt?.kind === 'photo' ? 'фото'
                          : opt?.kind ?? null;
                        const atLimit = carousel.length >= CAROUSEL_LIMIT && !inCarousel;
                        return (
                          <div
                            key={i}
                            className={`relative rounded-md overflow-hidden border bg-gray-50 ${
                              inCarousel
                                ? 'border-blue-500 ring-2 ring-blue-200'
                                : isCurrent
                                  ? 'border-emerald-500 ring-2 ring-emerald-200'
                                  : 'border-gray-200'
                            }`}
                          >
                            {opt?.url ? (
                              <img src={opt.url} alt="" className="w-full aspect-square object-cover" />
                            ) : (
                              <div className="w-full aspect-square flex items-center justify-center text-gray-300">
                                <ImageIcon size={20} />
                              </div>
                            )}
                            {/* checkbox «в карусель» — левый верх */}
                            {opt?.url && (
                              <label
                                title={atLimit ? `Лимит ${CAROUSEL_LIMIT} фото в карусели` : 'Добавить в карусель'}
                                className={`absolute top-1 left-1 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-white/95 backdrop-blur-sm border ${
                                  inCarousel ? 'border-blue-300 text-blue-700' : 'border-gray-200 text-gray-700'
                                } ${atLimit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={inCarousel}
                                  disabled={atLimit}
                                  onChange={() => toggleCarousel(opt.url)}
                                  className="w-3 h-3 accent-blue-600"
                                />
                                {inCarousel ? <>в карусели {carouselIdx + 1}</> : 'в карусель'}
                              </label>
                            )}
                            {isCurrent && (
                              <span className="absolute bottom-[34px] right-1 inline-flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-emerald-600 text-white">
                                <Check size={8} /> обложка
                              </span>
                            )}
                            <div className="px-1.5 py-1 text-[10px] text-gray-700 border-t border-gray-200 bg-white">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="truncate">{opt?.model ?? 'модель'}</span>
                                {kindLabel && (
                                  <span className="text-[8px] px-1 rounded bg-gray-100 text-gray-600 border border-gray-200 flex-shrink-0">
                                    {kindLabel}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-gray-500">{cost ?? '—'}</span>
                                {!isCurrent && opt?.url && (
                                  <button
                                    onClick={() => pickVariant(opt)}
                                    disabled={picking || saving}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
                                    title="Сделать обложкой (photo_url)"
                                  >
                                    {picking ? '…' : '✅ Обложка'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Карусель поста ───────────────────────────────── */}
            {carousel.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers size={11} />
                    Карусель поста ({carousel.length}{carousel.length >= CAROUSEL_LIMIT ? ` · лимит ${CAROUSEL_LIMIT}` : ''})
                  </label>
                  <button
                    onClick={() => setCarousel([])}
                    className="text-[10px] text-gray-500 hover:text-red-600"
                    disabled={saving}
                  >
                    Очистить
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mb-2">
                  {carousel.length === 1
                    ? 'Telegram отправит одно фото (обложка).'
                    : `Telegram отправит альбомом ${carousel.length} фото. Первое — обложка.`}
                </p>
                <ol className="space-y-1.5">
                  {carousel.map((url, idx) => (
                    <li
                      key={url + idx}
                      className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-2 py-1.5"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex-shrink-0">
                        {idx + 1}
                      </span>
                      <img src={url} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                      <div className="flex-1 text-[10px] text-gray-500 truncate font-mono">
                        {url.split('/').slice(-1)[0]?.slice(0, 60) ?? url.slice(0, 60)}
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => moveCarousel(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Вверх"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveCarousel(idx, 1)}
                          disabled={idx === carousel.length - 1}
                          className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Вниз"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => removeFromCarousel(idx)}
                          className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Убрать из карусели"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-2 flex items-center justify-end">
                  <button
                    onClick={saveCarousel}
                    disabled={!carouselDirty || busy === 'carousel:save' || saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Save size={12} />
                    {busy === 'carousel:save' ? 'Сохранение…' : 'Сохранить карусель'}
                  </button>
                </div>
              </div>
            )}

            {!redoingPhoto && (
              <RedoBlock
                kind="photo"
                placeholder="Что не так с фото? «Другой ракурс», «без людей», «больше неба»…"
                busyKey={busy}
                onSubmit={(c) => requestRedo('photo', c)}
              />
            )}
          </section>

          {/* ── История правок (feedback[]) ──────────────────────── */}
          {Array.isArray(draft.feedback) && draft.feedback.length > 0 && (
            <section className="px-4 py-3 border-t border-gray-100">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <History size={11} />
                История правок ({draft.feedback.length})
              </label>
              <ul className="mt-1.5 space-y-1.5">
                {draft.feedback.slice().reverse().map((f: FeedbackEntry, i) => (
                  <li
                    key={i}
                    className="text-[11px] bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5"
                  >
                    <span className={`inline-block text-[9px] px-1 py-0 mr-1.5 rounded border ${f.target === 'text' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-violet-100 text-violet-700 border-violet-200'}`}>
                      {f.target === 'text' ? 'ТЕКСТ' : 'ФОТО'}
                    </span>
                    <span className="text-gray-700 break-words">{f.comment}</span>
                    {f.applied_at && (
                      <span className="block text-[9px] text-gray-400 mt-0.5">{fmtMsk(f.applied_at, true)} МСК</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Куда публиковать (инфо, не редактируется) ─────────── */}
          {/* Маркетинг-посты распространяются НЕ в наш канал, а по
              рекрутинговым группам — их выбирает и постит агент сам
              (см. «Посев-план»). Человек только согласовывает текст/фото. */}
          <section className="px-4 py-3 border-t border-gray-100">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Куда публиковать</label>
            <div className="mt-1.5 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-600 leading-relaxed">
              📣 Рекрутинговые группы — агент распространяет автоматически (см. вкладку «Посев-план»), во много групп, человеческим темпом. VK → наше сообщество. Отдельно от Контент-плана.
            </div>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Расписание</label>
              <span className="text-[10px] text-blue-700 font-medium">МСК (UTC+3)</span>
            </div>
            <div className="flex items-center gap-2">
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
            {/* Крупный summary «когда» */}
            {scheduleAt && (
              <div className="mt-2 px-3 py-2 rounded-md border bg-indigo-50 border-indigo-200 text-indigo-900">
                <div className="text-sm font-semibold flex items-center gap-1.5">📅 Запланировано:</div>
                <div className="text-xs mt-0.5">
                  <strong>{fmtMsk(mskInputToUTC(scheduleAt), true)} МСК</strong>
                </div>
              </div>
            )}
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

/**
 * Drag&drop / клик зона загрузки фото.
 * Sergey directive 2026-06-04: «Сергей будет добавлять фото руками
 * прямо в CRM — это должно быть удобно (drag&drop или клик)».
 */
function UploadDropArea({
  busy,
  busyLabel,
  disabled,
  onPick,
  onFiles,
}: {
  busy: boolean;
  busyLabel?: string | null;
  disabled: boolean;
  onPick: () => void;
  onFiles: (files: FileList | File[]) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onClick={() => !disabled && !busy && onPick()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled && !busy) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled || busy) return;
        const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
        if (files.length) onFiles(files);
      }}
      className={`mt-2 rounded-md border-2 border-dashed px-3 py-3 text-center cursor-pointer transition-colors ${
        disabled || busy
          ? 'opacity-60 cursor-not-allowed border-gray-200 bg-gray-50'
          : over
            ? 'border-blue-500 bg-blue-50 text-blue-800'
            : 'border-blue-300 bg-blue-50/40 hover:bg-blue-50 text-blue-700'
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
        <Upload size={12} />
        {busy
          ? `Загрузка${busyLabel ? ` ${busyLabel}` : ''}…`
          : over
            ? 'Отпусти — добавлю в варианты (можно несколько)'
            : '⬆️ Загрузить свои фото (клик или перетащи — можно несколько PNG/JPG)'}
      </div>
      <div className="text-[10px] text-blue-600/80 mt-0.5">
        Файлы уходят в Storage, появляются в галерее «Варианты» — обложкой можно сделать кнопкой ✅ Обложка
      </div>
    </div>
  );
}

/**
 * Блок «коммент + кнопка переделать» — общий для текста и фото.
 * Локальный state для textarea, чтобы не сохранять при каждом нажатии.
 */
function RedoBlock({
  kind,
  placeholder,
  busyKey,
  onSubmit,
}: {
  kind: 'text' | 'photo';
  placeholder: string;
  busyKey: string | null;
  onSubmit: (comment: string) => void | Promise<void>;
}) {
  const [comment, setComment] = useState('');
  const busy = busyKey === `redo:${kind}`;
  return (
    <div className="mt-2.5 rounded-md border border-gray-200 bg-gray-50/50 p-2.5">
      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        <RotateCcw size={10} />
        Комментарий к {kind === 'text' ? 'тексту' : 'фото'}
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1 w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded focus:border-blue-500 focus:outline-none resize-y"
      />
      <div className="flex items-center justify-end mt-1.5">
        <button
          onClick={async () => { await onSubmit(comment); setComment(''); }}
          disabled={busy || !comment.trim()}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md disabled:opacity-40 ${
            kind === 'text'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {busy
            ? <RefreshCw size={11} className="animate-spin" />
            : kind === 'text' ? <Pencil size={11} /> : <Camera size={11} />}
          {busy ? 'Отправка…' : kind === 'text' ? '✏️ Переделать текст' : '🖼 Переделать фото'}
        </button>
      </div>
    </div>
  );
}
