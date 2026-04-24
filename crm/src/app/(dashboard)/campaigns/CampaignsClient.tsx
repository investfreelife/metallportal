'use client'
import { useState } from 'react'

const POST_TYPES = [
  { value: 'price_update', label: 'Обновление цен' },
  { value: 'product_focus', label: 'Обзор продукта' },
  { value: 'case_study', label: 'Кейс клиента' },
  { value: 'gost_tip', label: 'Совет по ГОСТ' },
  { value: 'market_review', label: 'Обзор рынка' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-50 text-blue-700',
  published: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', scheduled: 'Запланирован',
  published: 'Опубликован', failed: 'Ошибка'
}

export function CampaignsClient({ posts }: { posts: any[] }) {
  const [platform, setPlatform] = useState<'telegram' | 'vk'>('telegram')
  const [postType, setPostType] = useState('product_focus')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [localPosts, setLocalPosts] = useState(posts)
  const [preview, setPreview] = useState<any>(null)

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, post_type: postType }),
      })
      const { post } = await res.json()
      if (post) {
        setLocalPosts(prev => [post, ...prev])
        setPreview(post)
      }
    } finally {
      setGenerating(false)
    }
  }

  const publish = async (postId: string) => {
    setPublishing(postId)
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      })
      const data = await res.json()
      if (data.success) {
        setLocalPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, status: 'published', published_at: new Date().toISOString() } : p
        ))
        alert('✅ Пост опубликован в Telegram!')
      } else {
        alert(`❌ Ошибка: ${data.error}`)
      }
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-medium text-gray-900">Контент-машина</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">ИИ ведёт Telegram и VK автоматически</p>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
        <div className="text-[11px] font-medium text-purple-700 mb-3">✨ Генератор постов</div>
        <div className="flex gap-3 flex-wrap">
          <select value={platform} onChange={e => setPlatform(e.target.value as 'telegram' | 'vk')}
            className="text-[12px] border border-gray-300 rounded-lg px-3 py-2 bg-white">
            <option value="telegram">Telegram канал</option>
            <option value="vk">VK сообщество</option>
          </select>
          <select value={postType} onChange={e => setPostType(e.target.value)}
            className="text-[12px] border border-gray-300 rounded-lg px-3 py-2 bg-white flex-1">
            {POST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={generate} disabled={generating}
            className="bg-purple-600 text-white text-[12px] px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex-shrink-0">
            {generating ? 'Генерирую...' : '✨ Сгенерировать'}
          </button>
        </div>
        {preview && (
          <div className="mt-3 bg-white border border-purple-200 rounded-lg p-3">
            <div className="text-[10px] text-purple-600 font-medium mb-2">Предпросмотр поста</div>
            <div className="text-[12px] text-gray-800 whitespace-pre-wrap leading-relaxed mb-3">{preview.content}</div>
            <div className="flex gap-2">
              <button onClick={() => publish(preview.id)} disabled={!!publishing}
                className="bg-green-600 text-white text-[11px] px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {publishing === preview.id ? 'Публикую...' : '✓ Опубликовать'}
              </button>
              <button onClick={() => setPreview(null)} className="text-[11px] text-gray-500 px-3 py-1.5">Закрыть</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <span className="text-[12px] font-medium text-gray-900">История постов</span>
          <span className="text-[11px] text-gray-500">{localPosts.length} постов</span>
        </div>
        {localPosts.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-gray-500">
            Нет постов. Сгенерируйте первый пост выше.
          </div>
        ) : (
          localPosts.map(post => (
            <div key={post.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS[post.status]}`}>
                      {STATUS_LABELS[post.status]}
                    </span>
                    <span className="text-[10px] text-gray-400">{post.platform}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(post.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-700 line-clamp-2">{post.content}</p>
                </div>
                {post.status === 'draft' && (
                  <button onClick={() => publish(post.id)} disabled={!!publishing}
                    className="flex-shrink-0 text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-100 disabled:opacity-50">
                    {publishing === post.id ? '...' : 'Опубликовать'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
