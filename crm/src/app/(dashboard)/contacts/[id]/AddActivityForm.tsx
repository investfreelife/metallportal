'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, Loader2 } from 'lucide-react'

const TYPES = [
  { value: 'note', label: '📝 Заметка' },
  { value: 'call', label: '📞 Звонок' },
  { value: 'email', label: '✉️ Email' },
  { value: 'message', label: '💬 Сообщение' },
  { value: 'meeting', label: '🤝 Встреча' },
  { value: 'task', label: '✅ Задача' },
]

export default function AddActivityForm({ contactId }: { contactId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) { setError('Введите текст'); return }
    setLoading(true); setError('')

    const res = await fetch(`/api/contacts/${contactId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, subject: subject.trim() || null, body: body.trim() }),
    })

    setLoading(false)
    if (res.ok) {
      setOpen(false); setSubject(''); setBody(''); setType('note')
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error || 'Ошибка')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Добавить активность
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              type === t.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Заголовок (необязательно)"
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Текст активности..."
        rows={3}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        autoFocus
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
