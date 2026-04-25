'use client'
import { useState, useCallback } from 'react'
import { parseDocument } from '@/lib/ai-client'

interface ParseResult {
  proposal: string
  status: string
}

export function DocumentUpload() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await parseDocument(file)
      setResult(data)
    } catch {
      setError('Ошибка при обработке документа. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => setDragging(false)

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 bg-white'
        }`}
      >
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv"
          onChange={onInputChange}
          disabled={loading}
        />
        <div className="text-4xl mb-3">📄</div>
        <p className="font-medium text-gray-700">
          {loading ? 'Анализирую документ...' : 'Загрузите смету или проект'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          PDF, DOCX, XLSX — AI расшифрует и подберёт металл из каталога
        </p>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-blue-600 text-sm animate-pulse">
            <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Обрабатываю позиции...
          </div>
        )}
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
      )}

      {result && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-gray-900">Коммерческое предложение:</div>
            <button
              onClick={() => navigator.clipboard.writeText(result.proposal)}
              className="text-sm text-blue-600 hover:underline"
            >
              Скопировать КП
            </button>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {result.proposal}
          </div>
        </div>
      )}
    </div>
  )
}
