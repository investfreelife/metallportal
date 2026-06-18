'use client'

import { useEffect, useRef, useState } from 'react'

interface Comment {
  id: number
  author: string
  kind: 'note' | 'fact' | 'issue' | 'blocker'
  text: string
  attachment_url: string | null
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

const KIND_META: Record<Comment['kind'], { label: string; emoji: string; cls: string }> = {
  note:    { label: 'Заметка',  emoji: '📝', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  fact:    { label: 'Факт',     emoji: '✓',  cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  issue:   { label: 'Проблема', emoji: '⚠️', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  blocker: { label: 'СТОП',     emoji: '🛑', cls: 'bg-red-100 text-red-700 border-red-200' },
}

/**
 * Лёгкий ресайз в браузере: только если фото больше maxSide (2400px) ИЛИ
 * больше 4 MB. Иначе оставляем оригинал — Sergey хочет нормальные фото,
 * не пере-зажатые в кашу. Лимит бакета 5 MB.
 */
async function resizeIfNeeded(file: File, maxSide = 2400, maxBytes = 4_000_000): Promise<Blob> {
  // Уже маленький — возвращаем как есть
  if (file.size <= maxBytes) {
    const img = await loadImage(file)
    if (Math.max(img.width, img.height) <= maxSide) {
      img.remove?.()
      return file  // оригинал, без потерь
    }
  }
  // Иначе — пережимаем в webp
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    img.onerror = reject
    img.onload = () => {
      const w = img.width, h = img.height
      const scale = Math.min(1, maxSide / Math.max(w, h))
      const cw = Math.round(w * scale), ch = Math.round(h * scale)
      const c = document.createElement('canvas')
      c.width = cw; c.height = ch
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0, cw, ch)
      c.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/webp', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function CommentsTab({ leadSlug, initial }: { leadSlug: string; initial: Comment[] }) {
  const [comments, setComments] = useState<Comment[]>(initial)
  const [text, setText] = useState('')
  const [kind, setKind] = useState<Comment['kind']>('note')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  async function send() {
    if (!text.trim() && !file) return
    setSending(true)
    try {
      let blob: Blob | null = null
      let fileName = 'attachment.webp'
      if (file) {
        // Лёгкий ресайз: только если >2400px ИЛИ >4MB. Иначе оригинал.
        // Лимит сервера 5 MB.
        blob = await resizeIfNeeded(file, 2400, 4_000_000)
        // Если вернули оригинал — сохраняем его расширение
        if (blob === file) fileName = file.name
        // Если файл всё ещё >5MB после ресайза — последнее средство, пережать сильнее
        if (blob.size > 5_242_880) {
          blob = await resizeIfNeeded(file, 1800, 0)  // принудительно webp 85%
          fileName = 'attachment.webp'
        }
      }

      const fd = new FormData()
      fd.append('text', text.trim())
      fd.append('kind', kind)
      if (blob) fd.append('file', blob, fileName)

      const r = await fetch(`/api/dream/leads/${leadSlug}/comments`, { method: 'POST', body: fd })
      const j = await r.json()
      if (j.ok) {
        setComments((arr) => [j.comment, ...arr])
        setText(''); setFile(null); setKind('note')
        if (fileRef.current) fileRef.current.value = ''
      } else {
        alert(j.error || 'Не удалось добавить')
      }
    } finally {
      setSending(false)
    }
  }

  async function toggleResolve(c: Comment) {
    const newVal = !c.is_resolved
    setComments((arr) => arr.map((x) => x.id === c.id ? { ...x, is_resolved: newVal } : x))
    await fetch(`/api/dream/leads/${leadSlug}/comments/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: newVal })
    })
  }

  async function remove(c: Comment) {
    if (!confirm('Удалить комментарий?')) return
    setComments((arr) => arr.filter((x) => x.id !== c.id))
    await fetch(`/api/dream/leads/${leadSlug}/comments/${c.id}`, { method: 'DELETE' })
  }

  const blockers = comments.filter((c) => c.kind === 'blocker' && !c.is_resolved)

  return (
    <div>
      {blockers.length > 0 && (
        <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <h3 className="text-[13px] font-bold text-red-700 mb-2">🛑 Активные блокеры — агенты НЕ работают по лиду</h3>
          <ul className="list-disc pl-5 text-[12px] text-red-800 space-y-1">
            {blockers.map((b) => (<li key={b.id}>{b.text}</li>))}
          </ul>
        </div>
      )}

      {/* Composer */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['note','fact','issue','blocker'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                kind === k ? KIND_META[k].cls + ' font-bold' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}>
              {KIND_META[k].emoji} {KIND_META[k].label}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Например: «у компании уже есть сайт example.ru», «фото №3 с курткой — не их», «закрылись 2025-05»…"
          className="w-full text-[13px] border border-gray-200 rounded-md p-2.5 focus:outline-none focus:border-blue-400 mb-2 resize-none"/>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-[11px] file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-[11px] file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
          {preview && <img src={preview} alt="" className="h-12 w-12 rounded object-cover border border-gray-200"/>}
          <button onClick={send} disabled={sending || (!text.trim() && !file)}
            className="ml-auto text-[12px] bg-blue-600 text-white px-4 py-1.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50">
            {sending ? 'Отправляю…' : '+ Добавить'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Фото до 5 MB (оригинал). Больше — авто-сжатие до 2400px webp. Заметки видны агентам ПЕРЕД работой.
        </p>
      </div>

      {/* List */}
      {comments.length === 0 ? (
        <p className="text-center text-gray-400 italic py-8 text-[13px]">
          Пока нет комментариев. Любая заметка попадёт агентам автоматом.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const m = KIND_META[c.kind]
            return (
              <li key={c.id} className={`border rounded-xl p-3.5 ${c.is_resolved ? 'opacity-50' : ''} ${m.cls}`}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-[11px] font-bold">{m.emoji} {m.label}</span>
                  <span className="text-[10px] opacity-70">от {c.author}</span>
                  <span className="text-[10px] opacity-50 ml-auto">{new Date(c.created_at).toLocaleString('ru-RU')}</span>
                </div>
                {c.text && <p className="text-[13px] whitespace-pre-wrap mb-2">{c.text}</p>}
                {c.attachment_url && (
                  <a href={c.attachment_url} target="_blank" rel="noopener noreferrer">
                    <img src={c.attachment_url} alt="" className="max-h-48 rounded border border-white/50"/>
                  </a>
                )}
                {c.is_resolved && c.resolved_at && (
                  <div className="text-[10px] opacity-70 mt-1">✓ закрыт {c.resolved_by} {new Date(c.resolved_at).toLocaleDateString('ru-RU')}</div>
                )}
                <div className="flex gap-1 mt-2">
                  <button onClick={() => toggleResolve(c)} className="text-[10px] px-2 py-1 bg-white/70 rounded hover:bg-white">
                    {c.is_resolved ? '↩️ открыть' : '✓ закрыть'}
                  </button>
                  <button onClick={() => remove(c)} className="text-[10px] px-2 py-1 bg-white/70 rounded hover:bg-white text-red-600">
                    🗑 удалить
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
