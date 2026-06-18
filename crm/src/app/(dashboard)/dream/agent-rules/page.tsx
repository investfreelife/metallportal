export const dynamic = 'force-dynamic'

export default function AgentRulesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-[20px] font-semibold mb-1">📖 Правила для агентов</h1>
      <p className="text-[12px] text-gray-500 mb-6">
        Контракт для парсера, агента-кодера и оператора (Sergey). Версия 2.0 (2026-06-18).
      </p>

      {/* ARCHITECTURE */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">🏗 Архитектура — где что лежит</h2>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2">Слой</th>
              <th className="py-2">Что хранит</th>
              <th className="py-2">Где</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 font-medium">CRM (Supabase)</td>
              <td className="py-2">только МЕТАДАННЫЕ: URL, метки, статусы, связи. Никаких файлов&gt;200KB.</td>
              <td className="py-2"><code>metallportal-crm2.vercel.app/dream</code></td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Parser storage</td>
              <td className="py-2">СЫРЬЁ: фото лидов (webp), data.json, reviews.json, services.json</td>
              <td className="py-2"><a href="https://github.com/investfreelife/dream-landings" target="_blank" className="text-blue-600">github.com/investfreelife/dream-landings</a></td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Готовые лендинги</td>
              <td className="py-2">HTML+CSS клиентских сайтов и студийных витрин</td>
              <td className="py-2"><a href="https://investfreelife.github.io/" target="_blank" className="text-blue-600">investfreelife.github.io</a></td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Yandex CDN</td>
              <td className="py-2">оригиналы фото бизнесов — не качаем, ссылаемся</td>
              <td className="py-2"><code>avatars.mds.yandex.net/get-altay/...</code></td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* PARSER */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">🛰 Парсер — что делать после парсинга</h2>
        <ol className="list-decimal pl-5 text-[12px] space-y-2 text-gray-700">
          <li>
            Скачать фото с Я.Карт (ТОЛЬКО из <code>raw/yandex_gallery.html</code> — не из reviews,
            иначе попадают фото авторов / похожие карточки).
          </li>
          <li>
            Конвертировать → <b>WebP, ≤200 KB</b>, max 1200px по большей стороне.
            <pre className="bg-gray-50 p-2 rounded mt-1 text-[11px] overflow-x-auto">PIL Image.save(out, 'WEBP', quality=78, method=6)</pre>
          </li>
          <li>
            <b>Git push в <code>dream-landings</code></b>:
            <pre className="bg-gray-50 p-2 rounded mt-1 text-[11px] overflow-x-auto">{`git clone https://github.com/investfreelife/dream-landings
mkdir -p <slug>/photos
cp /tmp/<slug>/photos/*.webp <slug>/photos/
cp /tmp/<slug>/data.json reviews.json services.json <slug>/
git add <slug>/ && git commit -m "<slug>: parsed" && git push`}</pre>
          </li>
          <li>
            <b>POST в CRM</b> на <code>/api/dream/leads/import</code> с x-agent-token:
            <pre className="bg-gray-50 p-2 rounded mt-1 text-[11px] overflow-x-auto">{`{
  "leads": [{
    "slug": "<slug>",
    "name": "...", "niche": "...",
    "phone": "+7...",
    "yandex_url": "https://yandex.ru/maps/...",
    "rating": 4.4, "reviews_count": 110,
    ...
  }]
}`}</pre>
          </li>
          <li>
            Для каждого фото — INSERT в <code>dream_lead_photos</code> с
            <code>url = 'https://raw.githubusercontent.com/investfreelife/dream-landings/main/&lt;slug&gt;/photos/NN.webp'</code>
            и <code>source_url = Yandex CDN URL</code>.
          </li>
        </ol>
      </section>

      {/* OPERATOR */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">👤 Оператор (Sergey) — кураторская работа</h2>
        <ol className="list-decimal pl-5 text-[12px] space-y-2 text-gray-700">
          <li>В карточке лида вкладка <b>📷 Фото</b> — у каждого фото 2 кнопки:</li>
          <li><span className="inline-block w-5">⭐</span> <b>приоритет</b> — агент-кодер использует ИМЕННО эти 5–8 фото для hero/услуг лендинга.</li>
          <li><span className="inline-block w-5">🗑</span> <b>удалить</b> — мусор/левые фото (куртки, чужие BMW и т.д.). НЕ войдут в лендинг.</li>
          <li>В карточке лида вкладка <b>🌐 Лендинг</b> — посмотреть готовый сайт, выбрать активный вариант (chosen) для outreach.</li>
        </ol>
      </section>

      {/* CODER */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">🎨 Агент-кодер лендингов</h2>
        <ol className="list-decimal pl-5 text-[12px] space-y-2 text-gray-700">
          <li>Прочитай из CRM <code>dream_lead_photos</code> где <code>priority=true</code> и <code>deleted=false</code>.</li>
          <li>Возьми фото из <code>raw.githubusercontent.com/.../dream-landings/main/&lt;slug&gt;/photos/NN.webp</code>.</li>
          <li>Собери лендинг (по референсу из <code>dream_landings.template_id</code>).</li>
          <li>Пушь в <a href="https://github.com/investfreelife/investfreelife.github.io" target="_blank" className="text-blue-600">investfreelife.github.io</a> по пути <code>&lt;slug&gt;/</code> (или <code>&lt;slug&gt;/pro/</code> для PRO версии).</li>
          <li>
            INSERT в <code>dream_landings</code>:
            <pre className="bg-gray-50 p-2 rounded mt-1 text-[11px] overflow-x-auto">{`{
  "lead_slug": "<slug>", "variant": "modern", "version": "v1",
  "entry_url": "https://investfreelife.github.io/<slug>/",
  "set_chosen": true
}`}</pre>
          </li>
        </ol>
      </section>

      {/* RULES */}
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">⚖️ Жёсткие правила</h2>
        <ul className="list-disc pl-5 text-[12px] space-y-1.5 text-gray-800">
          <li><b>НЕ грузи фото/HTML в Supabase Storage.</b> Квота 1 GB убивает весь CRM.</li>
          <li><b>Yandex CDN URL — для оригиналов</b>, не пере-аплоадь.</li>
          <li><b>WebP обязательно</b> для фото в репо. JPG/PNG — fail на CI.</li>
          <li><b>≤200 KB</b> на фото (после оптимизации).</li>
          <li><b>Относительные ссылки</b> в HTML лендингов — чтоб переехать с github.io на свой домен без правок.</li>
          <li><b>Не выдумывай факты</b> (годы работы, акции). Из CRM или ничего.</li>
          <li><b>set_chosen=true</b> ставит только Sergey, не агент.</li>
          <li><b>Секреты только в <code>/Users/Shared/металл/_SECRETS/</code></b>, никогда не светить в логах/чате/git.</li>
        </ul>
      </section>

      {/* DOCS */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[15px] font-semibold mb-3">📚 Полные документы</h2>
        <ul className="list-disc pl-5 text-[12px] space-y-1 text-gray-700">
          <li><code>~/Documents/Claude/Projects/Мечта/app/queue/SPEC/CRM_DATA_CONTRACT.md</code> — куда парсер пишет</li>
          <li><code>~/Documents/Claude/Projects/Мечта/app/queue/SPEC/LANDING_FACTORY_AGENT_GUIDE.md</code> — как кодер делает лендинги</li>
          <li><code>~/Documents/Claude/Projects/Мечта/HANDS_AGENT_PROTOCOL.md</code> — общий протокол Рук</li>
          <li><code>~/.claude/projects/-Users-sergey/memory/law_heavy_files_free_storage_crm_metadata_only.md</code> — глобальный ЗАКОН про storage</li>
          <li><code>~/Documents/Claude/Projects/Мечта/SITES_REGISTRY.md</code> — реестр сайтов студии</li>
        </ul>
      </section>
    </div>
  )
}
