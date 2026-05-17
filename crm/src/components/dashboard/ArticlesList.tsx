import { createClient } from '@/lib/supabase/server'

/**
 * ArticlesList — Section 4 «Статьи (Юля)».
 *
 * URGENT 2026-05-17 DASHBOARD_HUMAN_LANGUAGE Phase C. Sergey не видит
 * что Юля пишет — этот компонент показывает все опубликованные статьи
 * + метрики per article (просмотры, заявки).
 *
 * Phase C v1 (lean): hardcoded list 3 опубликованных статей в metallportal/
 * content/blog/*.md + per-article views из marketing_metrics top_pages
 * (где page_url содержит /blog/{slug}). Drafts появятся когда Юля начнёт
 * писать визуально через CMS workflow — это Phase E.
 *
 * Future (Phase E): добавить metallportal/api/articles/list endpoint
 * который возвращает frontmatter + word_count из .md файлов, и Drafts row
 * с word_count + last_modified.
 */

export const dynamic = 'force-dynamic'

interface Article {
  slug: string
  title: string
  description: string
  publishedAt: string
  author: string
  wordCount: number
  url: string
  keywords: string[]
  status: 'published' | 'draft'
}

// Published articles — frontmatter copied from /metallportal/content/blog/*.md
// Auto-sync TODO Phase E: read frontmatter programmatically via /api/articles endpoint.
const PUBLISHED_ARTICLES: Article[] = [
  {
    slug: 'gost-armatura-dlya-stroitelstva-vybor-i-gosti',
    title: 'ГОСТ-арматура для строительства: классы (А240/А500/А600), маркировка, расчёты',
    description:
      'Гид по строительной арматуре по ГОСТ: классы прочности А240, А500С, А600, А800, маркировка рифления, расчёт на ленточный фундамент 10×10 м.',
    publishedAt: '2026-05-07',
    author: 'Харлансталь',
    wordCount: 2400,
    url: 'https://www.harlansteel.ru/blog/gost-armatura-dlya-stroitelstva-vybor-i-gosti',
    keywords: ['арматура А500С', 'ГОСТ-арматура', 'А240', 'А600'],
    status: 'published',
  },
  {
    slug: 'list-ili-truba-dlya-zabora-sravnenie',
    title: 'Лист или труба для забора: сравнение материалов, цен, монтажа',
    description:
      'Сравнение профильной трубы и листового металла для забора: цена, монтаж, срок службы, ветровая нагрузка.',
    publishedAt: '2026-05-10',
    author: 'Юля',
    wordCount: 1850,
    url: 'https://www.harlansteel.ru/blog/list-ili-truba-dlya-zabora-sravnenie',
    keywords: ['забор из листа', 'забор из трубы', 'профильная труба'],
    status: 'published',
  },
  {
    slug: 'sendvich-paneli-dlya-garazha-sravnenie-uteplitelya',
    title: 'Сэндвич-панели для гаража: какой утеплитель выбрать (PIR vs минвата)',
    description:
      'Сравнение сэндвич-панелей с PIR-утеплителем и минватой для гаражного строительства: цена, теплопроводность, монтаж.',
    publishedAt: '2026-05-15',
    author: 'Юля',
    wordCount: 2100,
    url: 'https://www.harlansteel.ru/blog/sendvich-paneli-dlya-garazha-sravnenie-uteplitelya',
    keywords: ['сэндвич-панели', 'PIR', 'минвата', 'гараж'],
    status: 'published',
  },
]

interface ArticleMetrics {
  views: number
  uniqueUsers: number
}

export default async function ArticlesList() {
  const supabase = await createClient()

  // Fetch top_pages from marketing_metrics, look for /blog/* URLs
  const { data: pageRows } = await supabase
    .from('marketing_metrics')
    .select('metric_value, metric_meta')
    .eq('source', 'metrika')
    .eq('metric_name', 'pageviews')
    .order('metric_value', { ascending: false })
    .limit(200)

  const viewsByPath = new Map<string, ArticleMetrics>()
  for (const r of (pageRows ?? []) as any[]) {
    const url = String(r.metric_meta?.page_url ?? '')
    const m = url.match(/\/blog\/([a-z0-9\-]+)/i)
    if (!m) continue
    const slug = m[1]
    const existing = viewsByPath.get(slug) ?? { views: 0, uniqueUsers: 0 }
    viewsByPath.set(slug, {
      views: existing.views + Number(r.metric_value || 0),
      uniqueUsers: existing.uniqueUsers + Number(r.metric_meta?.users || 0),
    })
  }

  // TODO Phase E: fetch leads-per-article — нужен goal_reaches с filter по
  // последней посещённой странице, в текущем Metrika ETL goal_reaches не
  // attribute к конкретной статье. Backlog item.

  const totalViews = Array.from(viewsByPath.values()).reduce((s, v) => s + v.views, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Статьи (Юля)</h2>
        <span className="text-[11px] text-gray-400">
          {PUBLISHED_ARTICLES.length} опубликовано · черновики — Phase E
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-baseline justify-between">
          <span className="text-[12px] font-medium text-gray-700">Опубликованные на harlansteel.ru/blog</span>
          {totalViews > 0 && (
            <span className="text-[11px] text-gray-500">
              {totalViews.toLocaleString('ru-RU')} просмотров суммарно (Metrika)
            </span>
          )}
        </div>

        <ul className="divide-y divide-gray-50">
          {PUBLISHED_ARTICLES.map((a) => {
            const metrics = viewsByPath.get(a.slug)
            const publishedDate = new Date(a.publishedAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
            })
            return (
              <li key={a.slug} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium text-gray-900 hover:text-blue-700 leading-snug block"
                    >
                      {a.title}
                    </a>
                    <div className="text-[11px] text-gray-600 mt-1 line-clamp-2">{a.description}</div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 flex-wrap">
                      <span>📝 {a.wordCount.toLocaleString('ru-RU')} слов</span>
                      <span>📅 {publishedDate}</span>
                      <span>✍ {a.author}</span>
                      {metrics ? (
                        <span className="text-green-700 font-medium">
                          👁 {metrics.views.toLocaleString('ru-RU')} просмотров (Metrika)
                        </span>
                      ) : (
                        <span className="text-gray-400">просмотров ещё нет</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {a.keywords.slice(0, 4).map((k) => (
                        <span
                          key={k}
                          className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1.5">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                    >
                      Открыть статью →
                    </a>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Drafts row hint */}
        <div className="px-4 py-3 border-t border-dashed border-gray-200 bg-gray-50/50">
          <div className="text-[11px] text-gray-500 leading-snug">
            <span className="font-medium text-gray-700">📝 Черновики:</span> когда Юля начнёт писать
            новые статьи — здесь появятся черновики с word_count, последним изменением и preview.
            Phase E добавит интеграцию с git workflow (через webhook на push в{' '}
            <code className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded">content/blog/</code>).
          </div>
        </div>
      </div>
    </section>
  )
}
