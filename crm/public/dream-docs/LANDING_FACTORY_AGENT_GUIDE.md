# LANDING FACTORY AGENT — гайд агенту-кодеру лендингов

**Версия:** 2.0 (2026-06-18) — после ЗАКОНА «Heavy/Temp не в Supabase»
**Статус:** обязательная для всех задач генерации лендингов
**Связан с:** `CRM_DATA_CONTRACT.md` (data contract парсера), `PARSING_PIPELINE_SPEC.md`

---

## 🛑 PRE-FLIGHT CHECK (обязательно перед любой генерацией)

```sql
-- 1. Активные блокеры? (компания закрыта, есть сайт, etc)
SELECT * FROM dream_lead_blockers WHERE lead_id = :lead_id;
-- если ЕСТЬ → STOP, лог dream_landing_generations.status='blocked_by_comment'

-- 2. Approval пройден?
SELECT build_status FROM dream_leads WHERE id = :lead_id;
-- если != 'approved' → STOP, лог status='blocked_not_approved'

-- 3. Build_plan существует?
SELECT build_plan_json FROM dream_leads WHERE id = :lead_id;
-- если NULL → STOP, нет указаний что собирать
```

Все три условия должны быть **зелёные**. Иначе агент **не запускается**, в лог пишется
причина, Sergey получает уведомление (через `dream_activities`).

---

## ⚖️ ЗАКОН 0 — Лендинги на GitHub Pages, не в Supabase

После Supabase Free quota lockup (2026-06-18) принят закон:

> **Готовые лендинги (HTML/CSS/изображения) ДЕПЛОИМ НА GITHUB PAGES.**
> **Фото лидов используем по URL Yandex CDN (не пере-аплоадим).**
> **Supabase Storage НЕ ИСПОЛЬЗУЕМ под лендинги.**

Это касается всех агентов: парсер, кодер, deployer. См.:
`~/.claude/projects/-Users-sergey/memory/law_heavy_files_free_storage_crm_metadata_only.md`

---

## 0. TL;DR — что ты делаешь

Ты получаешь slug лида (например `avtoclean`) → читаешь всю инфу о бизнесе
из Supabase → генерируешь **несколько вариантов многостраничных лендингов**
→ кладёшь HTML/CSS/assets в Supabase Storage → регистрируешь каждый вариант
строкой в таблице `dream_landings`. Каждый лид может иметь несколько
лендингов параллельно (modern/classic/minimal × v1/v2/…) — это позволяет
Sergey'ю выбрать лучший для outreach.

```
ВХОД:  lead_slug
   ↓
[1] Прочитать всё про лида из БД    → CRM_DATA_CONTRACT.md
[2] Решить варианты (1–3)            → выбор шаблона по нише
[3] Сгенерировать N×M страниц HTML   → templates/<niche>/<variant>.html
[4] Upload в Storage                 → dream-landings/<slug>/<variant>-<version>/
[5] POST /api/dream/landings/register → строка в dream_landings
   ↓
ВЫХОД: landing_id + URLs всех страниц
```

---

## 1. Откуда брать ПОЛНУЮ информацию о лиде

Источник правды — Supabase. **Никогда не читай локальные json/файлы Sergey'я**
(Vercel/прод не имеет доступа к его маку).

### 1.1 Главная запись — `dream_leads`

```sql
SELECT * FROM dream_leads WHERE slug = :slug AND tenant_id = '11111111-2222-3333-4444-555555555555';
```

Ты получишь:
- `name` — название бизнеса («Avtoclean»)
- `niche` — ниша («Автомойка / Автосервис»)
- `city`, `address`, `metro_nearest`, `geo_lat`, `geo_lon`
- `phone`, `phone_display`, `email`
- `social_json` — соцсети
- `rating`, `reviews_count`, `ratings_count`
- `services_count`, `photos_count` — счётчики
- `features_json` — `["24 часа","Wi-Fi","Кафе"]`
- `hours_json` — `{is_24_7, structured:{mon:[...],tue:[...]}, current_status}`
- `description_short`, `description_long`
- `completeness_score` — 0..1, насколько данные полные
- `yandex_url`, `gis_url` — оригинальные источники (для перепроверки)
- `ai_summary`, `ai_pitch` — если предыдущий шаг уже сгенерил

### 1.2 Фотогалерея — `dream_lead_photos`

```sql
SELECT idx, url, storage_path, width, height, bytes
  FROM dream_lead_photos
  WHERE lead_id = :lead_id
  ORDER BY idx;
```

Каждая строка — фото в Supabase Storage (CDN-кеширована, доступна по `url`).
**Не качай и не пере-аплоадь фото лида в лендинг.** Используй URL'ы напрямую
в `<img src="…">` (или прокси через `assets/img-N.webp` если нужна оптимизация).

### 1.3 Отзывы — `dream_lead_reviews`

```sql
SELECT idx, author, rating, review_date, text
  FROM dream_lead_reviews
  WHERE lead_id = :lead_id
  ORDER BY idx;
```

Обычно 50 sample-отзывов из ~110. Выбери для главной 3–5 лучших
(длина 100–300 символов, есть имя автора, недавняя дата), остальные —
на странице `reviews.html`.

### 1.4 Услуги с прайсом — `dream_lead_services`

```sql
SELECT idx, name, price, unit, description, source, is_default
  FROM dream_lead_services
  WHERE lead_id = :lead_id
  ORDER BY idx;
```

Если `is_default=true` — это дефолт-прайс по нише, не реальный. Поставь
на странице `services.html` пометку «*цены ориентировочные»; на главной —
покажи 3 hero-услуги без хвоста «от».

### 1.5 Бонус: сырой OSM/Yandex дамп — `dream_businesses`

```sql
SELECT raw_data FROM dream_businesses WHERE dream_lead_id = :lead_id LIMIT 1;
```

`raw_data` jsonb может содержать ещё не разобранные поля: `payment_methods`,
`accessibility`, `parking`, `wheelchair`. Используй как «надстройку».

### 1.6 Скрипт-помощник (читаем всё одним вызовом)

```python
def load_lead_fully(slug: str) -> dict:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    lead = supabase.from_('dream_leads').select('*') \
        .eq('slug', slug).eq('tenant_id', DREAM_TENANT_ID).single().execute().data
    photos   = supabase.from_('dream_lead_photos').select('*').eq('lead_id', lead['id']).order('idx').execute().data
    reviews  = supabase.from_('dream_lead_reviews').select('*').eq('lead_id', lead['id']).order('idx').execute().data
    services = supabase.from_('dream_lead_services').select('*').eq('lead_id', lead['id']).order('idx').execute().data
    biz      = supabase.from_('dream_businesses').select('raw_data').eq('dream_lead_id', lead['id']).maybeSingle().execute().data
    return {
        'lead': lead,
        'photos': photos,
        'reviews': reviews,
        'services': services,
        'raw_data': biz['raw_data'] if biz else {},
    }
```

---

## 2. Стратегия «РАЗНЫЕ лендинги чтоб не забыть»

Sergey хочет иметь **несколько готовых вариантов на каждом лиде**, чтобы:
- сравнить визуально и выбрать сильнейший,
- A/B-тестить на outreach,
- не забыть какой делали раньше (если перегенерил — старый сохранён).

### 2.1 Варианты — `variant`

Канонический список (расширяется по мере роста):

| `variant` | Подходит для | Hero | Палитра | Шрифт |
|---|---|---|---|---|
| `modern` | Премиум-ниши (стоматология, дизайн) | Видеофон, тонкий sans | white/charcoal | Inter / Manrope |
| `classic` | Доверие важнее «вау» (юристы, СТО, мед) | Большое фото + слоган | navy/cream | Lora / Georgia |
| `minimal` | Микро-бизнес, B2C массовые | Один screen, один CTA | white/black/accent | system-ui |
| `mobile-first` | Курьеры/такси/доставка | Огромная кнопка-телефон | bold accent | Roboto |
| `bold` | Молодёжные (барбершопы, тату) | Цветной градиент, крупные буквы | neon | Bebas + Geist |

Делай **минимум 2 разных** (например `modern` + `minimal`) — Sergey выберет.
Никогда не делай оба «modern» — теряется смысл сравнения.

### 2.2 Версии — `version`

Внутри одного `variant` — `v1`, `v2`, … когда:
- перегенерил с новой подсказкой / новыми данными,
- исправил баг и хочешь сохранить старую как archive,
- решил пересобрать тот же стиль на новых фото.

UNIQUE `(lead_id, variant, version)` в БД. Перезапись существующей пары =
UPDATE строки (старый файлы НЕ удаляй из Storage — пусть остаются как
артефакт).

### 2.3 Страницы внутри одного варианта

Минимум 1 (`index.html`). Целевой набор для коммерческого варианта:

| `slug` | `title` | Содержит |
|---|---|---|
| `index` | Главная | Hero + 3 hero-услуги + 3 hero-отзыва + CTA + контакты в футере |
| `services` | Услуги и цены | Все `dream_lead_services` с описаниями |
| `gallery` | Фото | Все `dream_lead_photos` (lazy load) |
| `reviews` | Отзывы | Все 50 `dream_lead_reviews`, сортировка по дате |
| `contacts` | Контакты | Адрес + Яндекс.Карта iframe + телефон + WhatsApp + часы |
| `about` | О нас *(опц.)* | description_long + features_json + годы работы (если знаем) |

Скип любой страницы, если данных нет (нет отзывов → нет `reviews.html`).
**Не лей пустые страницы.**

---

## 3. Куда класть файлы (GitHub Pages)

### 3.1 Репозиторий-фабрика

**Репо:** `github.com/investfreelife/dream-landings` (приватный, GitHub Pages enabled).
**URL Pages:** `https://investfreelife.github.io/dream-landings/<slug>/<variant>-<version>/`

Клонится локально на твою рабочую машину:
```bash
git clone git@github.com:investfreelife/dream-landings.git ~/dream-landings
```

### 3.2 Структура папок в репо

```
dream-landings/                          ← корень репо
  ├── .github/workflows/pages.yml         ← деплой
  ├── index.html                          ← общая landing-главная (опционально)
  ├── avtoclean/                          ← <lead_slug>
  │   ├── modern-v1/                      ← <variant>-<version>
  │   │   ├── index.html
  │   │   ├── services.html
  │   │   ├── gallery.html
  │   │   ├── reviews.html
  │   │   ├── contacts.html
  │   │   └── assets/
  │   │       ├── styles.css
  │   │       ├── og.jpg
  │   │       └── photos/                  ← optimised webp (≤200KB каждое)
  │   │           ├── 01.webp
  │   │           └── ...
  │   ├── classic-v1/                     ← второй вариант
  │   └── minimal-v1/                     ← третий вариант
  └── barbershop-vernadskogo/             ← другой лид
      └── ...
```

### 3.3 Workflow генерации

```bash
# 1. На свой /tmp качаешь фото лида из Yandex CDN (по dream_lead_photos.url)
mkdir -p /tmp/lead_avtoclean/photos
python3 download_yandex_photos.py --slug avtoclean --out /tmp/lead_avtoclean/photos

# 2. Конвертируешь в webp + ресайз ≤1200x800
for f in /tmp/lead_avtoclean/photos/*.jpg; do
  cwebp -q 75 -resize 1200 0 "$f" -o "${f%.jpg}.webp"
done

# 3. Рендеришь HTML из шаблона (jinja или handlebars)
python3 render_landing.py \
  --slug avtoclean --variant modern --version v1 \
  --photos /tmp/lead_avtoclean/photos/ \
  --out ~/dream-landings/avtoclean/modern-v1/

# 4. Commit + push (GitHub Pages деплоится автоматом через workflow)
cd ~/dream-landings
git add avtoclean/modern-v1/
git commit -m "avtoclean: modern-v1 generated by agent"
git push origin main

# 5. Через ~30 сек страница живёт на:
#    https://investfreelife.github.io/dream-landings/avtoclean/modern-v1/

# 6. Удалить временное
rm -rf /tmp/lead_avtoclean/
```

### 3.4 Относительные ссылки внутри лендинга

Все ссылки на assets и между страницами — **относительные**:
```html
<link rel="stylesheet" href="assets/styles.css">
<a href="services.html">Цены</a>
<img src="assets/photos/01.webp" loading="lazy" width="1200" height="800">
```

Это позволяет потом переехать с GitHub Pages на свой домен без правок HTML.

### 3.5 Фото лида в лендинге

⚠️ **НЕ ссылайся напрямую на Yandex CDN внутри лендинга.** Причины:
- Yandex может в любой момент сменить URL → битые ссылки
- Yandex может поставить `Referer` фильтр → не показывать с внешних сайтов
- Скорость / availability не гарантируем

**Правильно:** скачать → ресайз → webp → положить в `assets/photos/01.webp`
внутри своего префикса GitHub Pages → ссылаться из HTML.

После генерации **/tmp удалить** — фото живут только в лендинге.

### 3.6 Альтернативные хосты (если GitHub Pages не подходит)

| Хост | Стоимость | Когда выбрать |
|---|---|---|
| **GitHub Pages** ⭐ | $0 | Дефолт. Versioning, free SSL, fast CDN |
| **Cloudflare Pages** | $0 | Если хочется wrangler CLI и instant rollback |
| **Netlify Drop** | $0 | Если хочешь drag&drop без git |
| **Oracle ARM nginx** | $0 (твой сервер) | Если нужен свой домен и контроль |

**Никогда:** Supabase Storage, S3 с egress costs.

### 3.7 Когда понадобится свой домен

`mechta.click` или похожий — купить у reg.ru (~$5/год). DNS CNAME ведёт на
`investfreelife.github.io` или Cloudflare Pages. В репо `CNAME` файл.
Тогда URL станет `https://mechta.click/avtoclean/modern-v1/`.

---

## 4. Как регистрировать в БД

### 4.1 Endpoint

```
POST https://metallportal-crm2.vercel.app/api/dream/landings/register
Headers:
  Content-Type: application/json
  x-agent-token: $AGENT_WEBHOOK_TOKEN   # из /Users/Shared/металл/.env.local
```

### 4.2 Body — минимальный комплект

```json
{
  "lead_slug": "avtoclean",
  "variant": "modern",
  "version": "v1",
  "template_id": "autoservice_modern_v1",
  "storage_prefix": "avtoclean/modern-v1/",
  "pages": [
    { "slug": "index",    "title": "Главная",       "storage_path": "avtoclean/modern-v1/index.html",    "bytes": 24588 },
    { "slug": "services", "title": "Услуги и цены", "storage_path": "avtoclean/modern-v1/services.html", "bytes": 18211 },
    { "slug": "gallery",  "title": "Фото",          "storage_path": "avtoclean/modern-v1/gallery.html",  "bytes": 12903 },
    { "slug": "reviews",  "title": "Отзывы",        "storage_path": "avtoclean/modern-v1/reviews.html",  "bytes": 31055 },
    { "slug": "contacts", "title": "Контакты",      "storage_path": "avtoclean/modern-v1/contacts.html", "bytes":  8721 }
  ],
  "meta": {
    "generator_model": "claude-haiku-4-5",
    "color_scheme": "sky/charcoal",
    "hero_style": "fullbleed_photo",
    "ai_cost_usd": 0.012,
    "duration_sec": 47,
    "prompt_hash": "sha1:abcd…"
  },
  "set_chosen": false
}
```

### 4.3 Ответ

```json
{
  "ok": true,
  "landing_id": 7,
  "entry_url": "https://.../public/dream-landings/avtoclean/modern-v1/index.html",
  "urls": {
    "index":    "https://.../index.html",
    "services": "https://.../services.html",
    "gallery":  "https://.../gallery.html",
    "reviews":  "https://.../reviews.html",
    "contacts": "https://.../contacts.html"
  }
}
```

### 4.4 Идемпотентность

UNIQUE `(lead_id, variant, version)`. Повторный POST с теми же ключами =
UPDATE существующей строки (Storage файлы уже перезаписаны через `x-upsert`).
Безопасно вызывать N раз.

### 4.5 Выбор активного варианта (`is_chosen`)

- Если `set_chosen: true` — этот вариант ставится chosen + автоматически
  снимается флаг с предыдущего (триггер `dream_landing_chosen_sync`)
  и обновляется `dream_leads.landing_public_url` → этот URL пойдёт в
  outreach и в карточку лида (вкладка «Лендинг»).
- По умолчанию `set_chosen: false` — Sergey сам выберет в UI.

### 4.6 Логи генерации (рекомендованно)

```sql
INSERT INTO dream_landing_generations (
  lead_id, tenant_id, agent, variant, version, template_id,
  status, pages_generated, cost_usd, duration_sec, metadata,
  started_at, finished_at
) VALUES (
  :lead_id, '11111111-2222-3333-4444-555555555555', 'sergey-site-coder',
  :variant, :version, :template_id,
  'success', :pages_count, :cost_usd, :duration_sec,
  jsonb_build_object('prompt_hash', :prompt_hash),
  :started_at, NOW()
);
```

При failed — пишешь `status='failed'` + `error_message`.

---

## 5. Атрибуция и трекинг

Каждая ссылка-CTA в лендинге должна нести атрибуцию, чтобы CRM понимала
откуда пришёл лид:

```html
<!-- Звонок -->
<a href="tel:+79164665460?utm_source=dream-landing&utm_campaign=avtoclean&utm_content=modern-v1">
  Позвонить
</a>

<!-- WhatsApp -->
<a href="https://wa.me/79164665460?text=Здравствуйте,%20хочу%20узнать%20про%20услуги">
  WhatsApp
</a>

<!-- Telegram -->
<a href="https://t.me/+79164665460">Telegram</a>

<!-- Открыть в Яндекс.Картах -->
<a href="{{ lead.yandex_url }}" target="_blank" rel="noopener">Маршрут</a>
```

Замечание: для лендингов **наших клиентов** (которые мы продали) телефон
будет их собственный — он лежит в `dream_leads.phone`. Сейчас же
(до продажи) подменять телефон **нельзя** — это нарушит привычку клиента
видеть свой реальный номер.

---

## 6. Templates — где лежат и как использовать

### 6.1 Расположение

```
~/Documents/Claude/Projects/Мечта/app/templates/
  ├── _shared/
  │   ├── base.html              (общий каркас head/footer)
  │   ├── _components/           (header, footer, hero, cta_block, …)
  │   └── _macros.html           (формат телефона, рейтинг, часы)
  ├── autoservice/
  │   ├── modern_v1.html
  │   ├── classic_v1.html
  │   └── minimal_v1.html
  ├── beauty/
  ├── medical/
  ├── food/
  └── generic/                   (fallback для незнакомых ниш)
```

Поддиректории по нише — `niche_to_template_dir(lead.niche)`:
- «Автомойка / Автосервис», «Шиномонтаж», «СТО» → `autoservice/`
- «Парикмахерская», «Барбершоп», «Маникюр» → `beauty/`
- «Стоматолог», «Клиника» → `medical/`
- «Кафе», «Ресторан», «Пиццерия» → `food/`
- Всё прочее → `generic/`

### 6.2 Переменные шаблона

Используй Jinja2 (или handlebars). Переменные ВСЕ из `load_lead_fully`:

```jinja
<title>{{ lead.name }} — {{ lead.niche }} в Москве, {{ lead.metro_nearest }}</title>
<h1>{{ lead.name }}</h1>
<p>★ {{ lead.rating }} · {{ lead.reviews_count }} отзывов</p>

{% for s in services[:3] %}
  <div class="service">
    <h3>{{ s.name }}</h3>
    <p class="price">{{ s.price }} ₽</p>
  </div>
{% endfor %}

{% for r in reviews[:3] %}
  <blockquote>
    <p>«{{ r.text }}»</p>
    <cite>— {{ r.author }}, {{ r.review_date }}</cite>
  </blockquote>
{% endfor %}
```

### 6.3 Соглашения по тексту

- Заголовок главной: `{{ lead.name }} — {{ lead.niche }} {{ lead.metro_nearest|metro_prep }}`
- Подзаголовок: ★ рейтинг + кол-во отзывов + ключевые features
- НЕ выдумывай факты (годы работы, награды, акции) — если данных нет, не пиши.
- Если `is_24_7=true` — выделить «24 часа» на hero.

---

## 7. Workflow ИТОГО

```python
def generate_landings(lead_slug: str, variants: list[str] = ['modern','minimal']):
    data = load_lead_fully(lead_slug)

    for variant in variants:
        # 1. лог запуска
        gen_id = log_generation_start(data['lead']['id'], variant)
        started = time.time()

        try:
            # 2. подобрать шаблон
            template_dir = niche_to_template_dir(data['lead']['niche'])
            tpl_path = f"templates/{template_dir}/{variant}_v1.html"

            # 3. рендер всех страниц
            pages_to_make = decide_pages(data)  # ['index','services','gallery','reviews','contacts']
            pages_info = []
            for slug in pages_to_make:
                html = render_page(tpl_path, slug, data)
                local_path = f"build/{lead_slug}/{variant}-v1/{slug}.html"
                save_local(local_path, html)
                pages_info.append({
                    'slug': slug,
                    'title': PAGE_TITLES[slug],
                    'storage_path': f"{lead_slug}/{variant}-v1/{slug}.html",
                    'bytes': len(html.encode())
                })

            # 4. upload в Storage (HTML + assets)
            upload_dir_to_storage(
                local_dir=f"build/{lead_slug}/{variant}-v1/",
                storage_prefix=f"{lead_slug}/{variant}-v1/"
            )

            # 5. зарегистрировать в БД
            r = requests.post(
                f"{CRM_BASE}/api/dream/landings/register",
                headers={'x-agent-token': AGENT_WEBHOOK_TOKEN, 'Content-Type':'application/json'},
                json={
                    'lead_slug': lead_slug,
                    'variant': variant,
                    'version': 'v1',
                    'template_id': f"{template_dir}_{variant}_v1",
                    'storage_prefix': f"{lead_slug}/{variant}-v1/",
                    'pages': pages_info,
                    'meta': {
                        'generator_model': 'claude-haiku-4-5',
                        'duration_sec': time.time() - started,
                    }
                }
            )
            r.raise_for_status()

            log_generation_finish(gen_id, 'success', r.json()['landing_id'],
                                  duration=time.time() - started,
                                  pages_count=len(pages_info))
        except Exception as e:
            log_generation_finish(gen_id, 'failed', error=str(e))
            raise
```

---

## 8. Что НЕ делать

❌ Не пиши в локальные json/файлы Sergey'я — Vercel их не видит.
❌ Не качай фото лида и не пересохраняй — используй CDN URL напрямую.
❌ Не используй абсолютные ссылки внутри HTML (`https://tmzqirzyvmnkzfmotlcj…`)
  — только относительные, чтобы лендинг был перемещаемым.
❌ Не выдумывай факты (годы, награды, акции, «5000 довольных клиентов»).
❌ Не лей пустые страницы (`reviews.html` без отзывов).
❌ Не делай 2 варианта одного стиля (modern-v1 + modern-v2 одновременно).
❌ Не ставь `set_chosen: true` сам по умолчанию — выбор за Sergey.
❌ Не клади ничего за пределы своего префикса `<slug>/<variant>-<version>/`.
❌ Не логируй `AGENT_WEBHOOK_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY` в stdout/git.

---

## 9. Smoke checks (сделай после каждого варианта)

```sql
-- 1. Запись появилась в БД
SELECT id, variant, version, status, entry_url, jsonb_array_length(pages) AS pages_count
FROM dream_landings
WHERE lead_id = (SELECT id FROM dream_leads WHERE slug = 'avtoclean')
ORDER BY generated_at DESC;
```

```bash
# 2. Главная отдаёт 200
curl -sI "https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/dream-landings/avtoclean/modern-v1/index.html" | head -3

# 3. Относительные ссылки внутри корректны (нет 404)
curl -s "https://.../modern-v1/index.html" | grep -oE 'href="[^"]+"' | sort -u
```

```
# 4. Открой в CRM
https://metallportal-crm2.vercel.app/dream/leads/avtoclean
→ вкладка «Лендинги» — должны быть все твои варианты с превью
```

---

## 10. Quick reference

| Что | Куда |
|---|---|
| Прочитать всё про лида | `dream_leads + dream_lead_photos + dream_lead_reviews + dream_lead_services` |
| Куда сложить файлы | Storage `dream-landings/<slug>/<variant>-<version>/` |
| Public URL | `https://tmzqirzyvmnkzfmotlcj.supabase.co/storage/v1/object/public/dream-landings/<…>` |
| Регистрация в БД | `POST /api/dream/landings/register` |
| Логи запуска | `dream_landing_generations` |
| Выбрать активный | `set_chosen:true` в POST, или UPDATE `dream_landings.is_chosen=true` |

---

## 11. Что появится в CRM UI (для понимания контекста)

- `/dream/leads/<slug>` — карточка лида. Вкладка «Лендинги» покажет
  все ряды из `dream_landings`: превью, кнопка «открыть», «выбрать активным»,
  «архив», «удалить».
- `/dream/landings` — общая галерея всех сгенерированных вариантов
  (фильтр по нише, по template_id, по дате).
- `/dream/parser` — вкладка 3 «Полный парсинг»: если у лида есть chosen
  лендинг — бейдж «лендинг ✓».
- `/contacts` (тенант Мечты) — клик по контакту с source='dream_landing'
  → откроет /dream/leads/<slug> с этими же лендингами.

---

_Гайд стабилен. Любые изменения через PR + бамп версии._
