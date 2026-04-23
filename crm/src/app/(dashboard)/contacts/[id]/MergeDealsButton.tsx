'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GitMerge } from 'lucide-react'

export default function MergeDealsButton({ contactId, openDealsCount }: { contactId: string; openDealsCount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (openDealsCount < 2) return null

  const merge = async () => {
    if (!confirm(`Объединить ${openDealsCount} открытых сделок в одну?`)) return
    setLoading(true)
    setMsg(null)
    const res = await fetch(`/api/contacts/${contactId}/merge-deals`, { method: 'POST' })
    const d = await res.json()
    setMsg({ ok: d.ok, text: d.message ?? d.error ?? 'Ошибка' })
    setLoading(false)
    if (d.ok) router.refresh()
  }

  return (
    <div className="space-y-2">
      <button
        onClick={merge}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
      >
        <GitMerge className="w-3.5 h-3.5" />
        {loading ? 'Объединяю...' : `Объединить ${openDealsCount} сделки в одну`}
      </button>
      {msg && (
        <p className={`text-xs px-2 py-1 rounded ${msg.ok ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}
