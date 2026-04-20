# ARCHITECTURE.md — МеталлПортал
*Последнее обновление: 19 апреля 2026*

## Что за проект
Маркетплейс металлопроката и металлоконструкций для России (B2B + B2C).
- URL: https://metallportal.vercel.app
- GitHub: https://github.com/investfreelife/metallportal
- 12 166 товаров от 1 поставщика (Металл Комплект)

---

## Технический стек
| Слой | Технология | Версия |
|---|---|---|
| Фреймворк | Next.js (App Router) | 14.2.3 |
| Язык | TypeScript | ^5.3.3 |
| Стили | Tailwind CSS | ^3.4.1 |
| БД / Хранилище / Auth | Supabase (PostgreSQL) | ^2.39.0 |
| Деплой | Vercel (автодеплой из main) | — |
| Иконки | Lucide React | ^1.8.0 |
| Темы | next-themes | ^0.4.6 |
| Фото AI | fal.ai (@fal-ai/client) | ^1.9.5 |
| SEO AI | OpenRouter (gpt-4o-mini via openai sdk) | ^6.34.0 |
| Тестирование | Playwright | ^1.59.1 |

---

## Структура папок

```
app/                        — Next.js App Router страницы
  page.tsx                  — Главная страница (лендинг)
  layout.tsx                — Root layout (шрифты, тема, хедер, футер)
  globals.css               — Tailwind + CSS переменные темы
  cart/page.tsx             — Корзина (client, useCart)
  search/page.tsx           — Поиск по сайту
  tools/page.tsx            — Калькуляторы металлопроката
  catalog/
    layout.tsx              — Sidebar + CatalogFiltersProvider
    [category]/page.tsx     — Уровень 1 (список подкатегорий)
    [category]/[subcategory]/page.tsx — Уровень 2 (товары CatalogView)
    gotovye-konstruktsii/   — Спец. страница конструкций
    navesy/                 — Спец. страница навесов
  admin/
    page.tsx                — Дашборд (статистика)
    products/               — Управление товарами
    categories/             — Управление категориями
    users/                  — Управление пользователями
    settings/               — Настройки сайта
    photos/                 — Генерация фото через fal.ai
    homepage/               — Редактор главной страницы
    menu/                   — Редактор меню
  api/
    search/route.ts         — Поиск товаров (edge, ILIKE по словам)
    orders/route.ts         — Создание заказа
    popular-products/route.ts — Топ товаров для главной
    generate-image/route.ts — Генерация фото через fal.ai
    admin/upload-image/     — Загрузка фото в Supabase Storage
  account/                  — Личный кабинет (заготовка, не готово)
  supplier/                 — Кабинет поставщика (заготовка, не готово)
  dashboard/                — (заготовка)

components/
  layout/                   — Header, Footer, MobileMenu, NavBar
  catalog/
    CatalogSidebar.tsx      — Боковое меню категорий (sticky, мобильный toggle)
    CatalogView.tsx         — Список товаров (фильтры, сортировка, пагинация)
    ProductTable.tsx        — Таблица товаров (desktop) + MobileProductRow
    ProductCard.tsx         — Карточка товара (grid-режим)
    ProductDetailView.tsx   — Страница товара (табы: описание, хар-ки, цена)
    ProductTabs.tsx         — Табы на странице товара
    PriceBlock.tsx          — Блок цены + кнопки (В корзину, Получить цену)
    ProductCalculator.tsx   — Мини-калькулятор на странице товара
    CatalogCategoryCard.tsx — Карточка категории
    SupplierPriceTable.tsx  — Таблица цен поставщика
    Filters.tsx             — Панель фильтров
    SpecsTable.tsx          — Таблица характеристик
    NavesProductDetail.tsx  — Детальная страница навеса
    NavesOrderModal.tsx     — Модал заказа навеса
    CategoryCallbackCTA.tsx — CTA блок обратного звонка
  tools/
    WeightCalc.tsx          — Калькулятор веса металла
    FoundationCalc.tsx      — Калькулятор арматуры фундамента
    MeshCalc.tsx            — Калькулятор арматурной сетки
    SheetCalc.tsx           — Калькулятор раскроя листа
    EstimateCalc.tsx        — Калькулятор сметы (добавление в список)
    ToolSearchBox.tsx       — Переиспользуемый поиск товаров для калькуляторов
  home/                     — Секции главной страницы
  ui/                       — Базовые компоненты (кнопки, inputs)
  ThemeProvider.tsx         — next-themes провайдер
  ThemeToggle.tsx           — Кнопка смены темы

contexts/
  CartContext.tsx            — Корзина (localStorage, addItem/removeItem/updateQty)
  CatalogFiltersContext.tsx  — Состояние фильтров каталога

hooks/
  useProductPrice.ts         — Поиск товара по запросу + ProductHit интерфейс + calcTotalRub()

lib/
  supabase.ts               — Supabase клиент
  queries.ts                — Все запросы к БД (getCategories, getProducts, etc.)
  database.types.ts         — TypeScript типы из Supabase
  metalCalc.ts              — Формулы расчёта веса металла (ГОСТ данные)
  settings.ts               — Загрузка настроек из site_settings
  fal.ts                    — Клиент fal.ai для генерации фото

scripts/
  generate_cards.ts         — SEO генерация через OpenRouter (gpt-4o-mini)
  import_remaining.ts       — Импорт товаров в Supabase
  (19 скриптов всего)

supabase/                   — Миграции и схема БД
data/
  catalog_full.json         — 12 166 товаров (исходник)
docs/                       — Документация (ты здесь)
```

---

## База данных (Supabase)

### Таблицы
```sql
products
  id uuid PK
  name text                 -- "Арматура кл А1 мотки Ст3 ⌀12 мм ГОСТ 5781-82"
  slug text UNIQUE          -- "armatura-a1-motki-st3-d12"
  article text
  description text
  gost text
  steel_grade text
  unit text                 -- "т", "м", "кг", "шт", "м²"
  weight_per_meter numeric  -- кг/м (для расчётов)
  image_url text
  category_id uuid FK → categories.id
  seo_title text
  seo_description text
  seo_text text
  created_at timestamptz

categories
  id uuid PK
  name text
  slug text
  parent_id uuid FK → categories.id (NULL = корень)
  level int (1,2,3)
  is_active bool
  sort_order int
  image_url text
  description text

suppliers
  id uuid PK
  name text                 -- "Металл Комплект"
  slug text

price_items
  id uuid PK
  product_id uuid FK → products.id
  supplier_id uuid FK → suppliers.id
  base_price numeric        -- цена за единицу unit
  discount_price numeric
  in_stock bool
  stock_quantity numeric
  updated_at timestamptz

site_settings                -- key-value настройки сайта
orders                       -- заказы с корзины
```

### RPC функции
- `get_product_counts()` — рекурсивный счётчик товаров по категориям (обходит лимит 1000)

---

## API маршруты

### GET /api/search
**Параметры:** `q` (строка), `limit` (число, макс 100)
**Работа:** ILIKE поиск по всем словам запроса, возвращает товары с ценами
**Ответ:** массив `ProductHit[]`
```typescript
interface ProductHit {
  id: string
  name: string
  slug: string
  price: number | null       // ₽ за единицу unit
  unit: string               // "т", "м", "кг" и т.д.
  weight_per_meter: number | null
  categoryName: string
  image_url: string | null
  href: string               // /catalog/metalloprokat/armatura/...
}
```
**Runtime:** edge (быстрый)

### POST /api/orders
Создаёт заказ из корзины, записывает в таблицу `orders`

### GET /api/popular-products
Топ-4 товаров для главной страницы

### POST /api/generate-image
Генерация фото через fal.ai (flux-pro)

---

## Калькуляторы (/tools)

Все 5 калькуляторов используют пошаговый интерфейс (шаги 1-4):

| Калькулятор | Шаг 1 | Шаг 2 | Шаг 3 | Шаг 4 |
|---|---|---|---|---|
| **WeightCalc** | Тип металла | Длина (м.п.) | Поиск товара | Результат (тонны + цена) |
| **FoundationCalc** | Тип фундамента | Параметры (L,W,H...) | Поиск арматуры | Результат |
| **MeshCalc** | Параметры сетки | — | Поиск арматуры | Результат |
| **SheetCalc** | Размеры листа/детали | — | Поиск листа | Результат |
| **EstimateCalc** | Поиск товара | Добавление позиций | — | Смета + В корзину |

**ToolSearchBox** (`components/tools/ToolSearchBox.tsx`):
- Принимает `initialQuery` — автоматически запускает поиск при монтировании
- Дебаунс 280мс, минимум 2 символа
- При `selected` — показывает зелёную плашку с товаром
- Пропсы: `placeholder`, `initialQuery`, `onSelect`, `selected`, `onClear`

**Стили результата** (единые для всех калькуляторов):
- Итого тонн: `text-4xl font-black text-gold`
- К оплате: `text-3xl font-black text-emerald-500`
- Кнопка "В корзину": `py-2 text-sm font-semibold` (компактная)

**Расчёт цены** (`hooks/useProductPrice.ts → calcTotalRub`):
- Единица "т" → price × tons
- Единица "м"/"м.п." → price × meters
- Единица "кг" → price × tons × 1000

---

## Корзина (CartContext)

- Хранится в `localStorage` (ключ: `cart`)
- `addItem(item)` — добавляет или увеличивает количество
- `removeItem(id)` — удаляет позицию
- `updateQty(id, qty)` — меняет количество (qty=0 = удалить)
- `clearCart()` — очищает корзину
- Структура item: `{ id, name, slug, unit, price, image_url, tons?, meters?, quantity }`

---

## Темы (dark/light)

CSS переменные определены в `app/globals.css`:
- `--background`, `--foreground`, `--card`, `--border`
- `--muted`, `--muted-foreground`
- `--gold` / `--gold-dark` (фирменный золотой цвет)
- `--success`

Классы Tailwind: `bg-background`, `text-foreground`, `border-border`, `text-gold`, `bg-card` и т.д.

---

## Деплой

```bash
git add -A && git commit -m "описание" && git push origin main
# Vercel автоматически деплоит из ветки main
# Сборка: ~2-4 минуты
# URL: metallportal.vercel.app
```

TypeScript проверка перед деплоем:
```bash
npx tsc --noEmit
```

---

## Окружение (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://tmzqirzyvmnkzfmotlcj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=...       # для SEO генерации
FAL_KEY=...                  # для генерации фото (добавить!)
```

---

## Адаптивность

- Все страницы адаптированы под мобильные
- `/tools` — табы калькуляторов: `flex-wrap` (переносятся на строку)
- `/cart` — карточки товаров: 2-строчный layout (фото+название / кол-во+цена+удалить)
- Каталог: `MobileProductRow` для xs/sm, `TableRow` для md+
- Сайдбар каталога: `mobileOpen` toggle для мобильных

---

## Правила для агентов

1. **Перед началом работы** прочитай `docs/PROJECT_STATUS.md`
2. **После каждого изменения** обновить `docs/PROJECT_STATUS.md`
3. **TypeScript** всегда проверять: `npx tsc --noEmit`
4. **Не менять** изображения, тексты, визуальный дизайн без явного запроса
5. **Деплой** только через git push (Vercel автоматический)
6. **Стиль кода**: без лишних комментариев, TypeScript strict
