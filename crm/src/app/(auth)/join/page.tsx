'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

function JoinForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''

  const [step, setStep] = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [info, setInfo] = useState<{ name: string; login: string } | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStep('error'); return }
    fetch(`/api/team/join?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setStep('error'); setError(d.error) }
        else { setInfo(d); setStep('form') }
      })
      .catch(() => setStep('error'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Пароль — минимум 6 символов'); return }
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    setSubmitting(true); setError('')
    const res = await fetch('/api/team/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const d = await res.json()
    setSubmitting(false)
    if (d.ok) setStep('done')
    else setError(d.error || 'Ошибка')
  }

  if (step === 'loading') return (
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      <p className="text-gray-400">Проверяем приглашение...</p>
    </div>
  )

  if (step === 'error') return (
    <div className="flex flex-col items-center gap-3">
      <XCircle className="w-10 h-10 text-red-400" />
      <p className="text-white font-semibold">Ссылка недействительна</p>
      <p className="text-gray-500 text-sm text-center">{error || 'Приглашение истекло или уже использовано'}</p>
    </div>
  )

  if (step === 'done') return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-400" />
      <div>
        <p className="text-white font-semibold text-lg">Аккаунт активирован!</p>
        <p className="text-gray-400 text-sm mt-1">Теперь вы можете войти в CRM</p>
      </div>
      <button
        onClick={() => router.push('/login')}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Войти в CRM
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="text-center mb-2">
        <p className="text-gray-400 text-sm">Аккаунт для</p>
        <p className="text-white font-semibold">{info?.name}</p>
        <p className="text-gray-500 text-xs font-mono">{info?.login}</p>
      </div>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">Новый пароль</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Минимум 6 символов"
          autoFocus
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">Повторите пароль</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Повторите пароль"
          className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Активировать аккаунт
      </button>
    </form>
  )
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white">МеталлПортал CRM</h1>
          <p className="text-gray-400 text-sm mt-1">Активация аккаунта</p>
        </div>
        <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto" />}>
          <JoinForm />
        </Suspense>
      </div>
    </div>
  )
}
