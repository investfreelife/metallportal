# 📱 ЗАДАНИЕ: Мобильное приложение МеталлПортал
## iOS + Android | React Native + Expo

---

## КОНТЕКСТ ПРОЕКТА

Существующий сайт: metallportal.vercel.app  
Repo: github.com/investfreelife/metallportal  
Стек сайта: Next.js 14 + TypeScript + Tailwind + Supabase  
Supabase project: tmzqirzyvmnkzfmotlcj  
БД: products (12166 товаров), categories, suppliers, price_items, site_settings  

---

## СТЕК МОБИЛЬНОГО ПРИЛОЖЕНИЯ

```
React Native + Expo SDK 51
TypeScript
Supabase JS Client v2 (тот же проект, та же БД)
Expo Router (file-based навигация)
NativeWind (Tailwind для RN)
Zustand (глобальный стейт)
React Query (кэш запросов)
Socket.io / Supabase Realtime (мессенджер)
Expo AV (запись/воспроизведение голоса)
expo-document-picker (выбор файлов)
expo-file-system (загрузка/хранение файлов)
expo-notifications (push)
OpenRouter API (ИИ-агент, модель gpt-4o-mini)
EAS Build (сборка iOS + Android)
```

---

## АРХИТЕКТУРА ПРИЛОЖЕНИЯ

```
mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx          ← нижняя навигация (5 табов)
│   │   ├── index.tsx            ← Главная / каталог
│   │   ├── catalog/
│   │   │   ├── index.tsx        ← Список категорий L1
│   │   │   ├── [slug].tsx       ← Категория L2
│   │   │   └── [slug]/[id].tsx  ← Карточка товара
│   │   ├── chat/
│   │   │   ├── index.tsx        ← Список чатов
│   │   │   ├── [id].tsx         ← Чат с поставщиком
│   │   │   └── ai.tsx           ← ИИ-агент
│   │   ├── orders.tsx           ← Мои заказы
│   │   └── profile.tsx          ← Личный кабинет
├── components/
│   ├── catalog/
│   ├── chat/
│   ├── ai/
│   └── ui/
├── lib/
│   ├── supabase.ts
│   ├── openrouter.ts
│   └── storage.ts
├── stores/
│   ├── authStore.ts
│   ├── cartStore.ts
│   └── chatStore.ts
├── types/
└── constants/
```

---

## МОДУЛЬ 1: АВТОРИЗАЦИЯ

### Требования
- Вход по email + пароль через Supabase Auth
- Регистрация (покупатель / поставщик — радиокнопка)
- Восстановление пароля через email
- Сохранение сессии (SecureStore)
- Биометрия (Face ID / Touch ID) при повторном входе

### Таблицы Supabase
```sql
-- Используем auth.users Supabase
-- Добавить таблицу profiles:
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'buyer', -- buyer | supplier
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Экраны
- `login.tsx` — форма входа, кнопка Google OAuth
- `register.tsx` — форма регистрации с выбором роли
- `forgot-password.tsx` — форма сброса пароля

---

## МОДУЛЬ 2: КАТАЛОГ

### Требования
- 3 уровня: L1 → L2 → карточка товара
- Поиск по названию, артикулу, ГОСТ
- Фильтры: сталь, ГОСТ, наличие, цена
- Сортировка: цена, название, популярность
- Пагинация (infinite scroll, по 20 товаров)
- Кнопка "В корзину" / "Запросить цену"
- Offline-кэш последних просмотренных товаров

### Запросы (reuse из lib/queries.ts сайта)
```typescript
// Категории с рекурсивными счётчиками
const { data } = await supabase.rpc('get_category_tree')

// Товары в категории с пагинацией
const { data } = await supabase
  .from('products')
  .select('*, price_items(*)')
  .eq('category_id', categoryId)
  .range(offset, offset + 19)
```

### Карточка товара (tabs как на сайте)
- Таб 1: Описание + характеристики
- Таб 2: Цена и наличие (real-time из price_items)
- Таб 3: Калькулятор (вес/длина)
- Таб 4: SEO-текст (seo_text из БД)
- Кнопки: Добавить в корзину | Написать поставщику | Запросить КП

---

## МОДУЛЬ 3: МЕССЕНДЖЕР

### Требования
КРИТИЧНО: Это основная ценность приложения для B2B.

**Типы чатов:**
1. Покупатель ↔ Поставщик (по конкретному товару)
2. Покупатель ↔ ИИ-агент
3. Групповые чаты (сделка с несколькими поставщиками)

**Функции чата:**
- Текстовые сообщения (realtime)
- Голосовые сообщения (запись/воспроизведение/прогресс-бар)
- Файлы: PDF, Excel, DWG, изображения (до 50 МБ)
- Статусы: отправлено / доставлено / прочитано
- Ответ на сообщение (reply/quote)
- Реакции (эмодзи)
- Поиск по истории чата
- Пересылка товара из каталога (карточка-превью в чате)

### Таблицы Supabase для мессенджера
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT DEFAULT 'direct', -- direct | group | ai
  product_id UUID REFERENCES products(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversation_participants (
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES auth.users(id),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES auth.users(id),
  type TEXT DEFAULT 'text', -- text | voice | file | product_card | system
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  voice_duration INTEGER, -- секунды
  reply_to_id UUID REFERENCES messages(id),
  product_id UUID REFERENCES products(id), -- для карточек товара
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
```

### Storage buckets
```
chat-files/         ← файлы в чатах
chat-voice/         ← голосовые сообщения (.m4a)
avatars/            ← фото профилей
```

### Реализация голосовых сообщений
```typescript
// Запись
import { Audio } from 'expo-av'

const startRecording = async () => {
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  )
  setRecording(recording)
}

const stopAndSend = async () => {
  await recording.stopAndUnloadAsync()
  const uri = recording.getURI()
  // загружаем в Supabase Storage → chat-voice/
  // отправляем сообщение с type='voice'
}

// Воспроизведение с прогресс-баром
const { sound } = await Audio.Sound.createAsync({ uri: message.file_url })
await sound.playAsync()
```

### Realtime подписка
```typescript
const subscription = supabase
  .channel(`chat:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

---

## МОДУЛЬ 4: ИИ-АГЕНТ

### Описание
Встроенный ИИ-ассистент по металлопрокату. Работает как отдельный чат + кнопка "Спросить ИИ" в карточке товара.

### Возможности агента
1. **Подбор металла** — "Нужна труба для водопровода DN50, давление 6 атм" → предлагает конкретные позиции из каталога
2. **Расчёт веса** — "Сколько весит балка I20 длиной 6 метров?"
3. **Расшифровка ГОСТ** — "Что означает ГОСТ 8732-78?"
4. **Сравнение позиций** — показывает таблицу из каталога
5. **Помощь с заказом** — черновик заявки поставщику
6. **Анализ прайс-листа** — пользователь загружает Excel, агент сравнивает с каталогом

### Системный промпт
```
Ты — эксперт по металлопрокату и помощник маркетплейса МеталлПортал.
Ты помогаешь покупателям подобрать металл, рассчитать вес и стоимость,
разобраться в технических характеристиках.

У тебя есть доступ к каталогу товаров. Когда рекомендуешь позицию —
включай артикул, единицу измерения и ссылку на карточку.

Отвечай кратко и по делу. Используй таблицы для сравнения.
Если не знаешь — честно скажи.

Каталог: [динамически вставляется контекст из БД по запросу]
```

### Интеграция с каталогом
```typescript
// При отправке сообщения — RAG поиск по товарам
const searchProducts = async (query: string) => {
  const { data } = await supabase
    .from('products')
    .select('name, article, unit, seo_description')
    .textSearch('name', query)
    .limit(5)
  return data
}

// Добавляем в контекст запроса к OpenRouter
const context = `Найденные товары:\n${JSON.stringify(products)}`
```

### API вызов
```typescript
const callAI = async (messages: Message[], context: string) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + context },
        ...messages
      ],
      stream: true  // стриминг для плавного вывода
    })
  })
  // обработка stream
}
```

### UI ИИ-чата
- Стриминг ответа (буква за буквой как в ChatGPT)
- Карточки товаров прямо в ответе (нажал → открыл каталог)
- Кнопки быстрых вопросов: "Подобрать трубу", "Рассчитать вес", "Найти аналог"
- Загрузка файла (прайс-лист Excel) для анализа

---

## МОДУЛЬ 5: КОРЗИНА И ЗАКАЗЫ

### Корзина
- Добавление товаров с указанием количества и единицы
- Разбивка по поставщикам
- Расчёт итоговой суммы
- Кнопка "Запросить КП" → создаёт заявку + открывает чат с поставщиком
- Персистентность через AsyncStorage

### Заказы
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id),
  supplier_id UUID REFERENCES suppliers(id),
  status TEXT DEFAULT 'draft', -- draft|sent|confirmed|shipped|delivered|cancelled
  total_amount DECIMAL(12,2),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(10,3),
  unit TEXT,
  price DECIMAL(10,2)
);
```

---

## МОДУЛЬ 6: ПРОФИЛЬ

### Покупатель
- Редактирование: имя, компания, телефон, фото
- История заказов
- Избранные товары
- Настройки уведомлений
- Привязанные поставщики

### Поставщик (отдельный раздел)
- Управление прайс-листом (импорт Excel)
- Входящие заявки
- Статистика просмотров товаров
- Настройки чата

---

## МОДУЛЬ 7: PUSH-УВЕДОМЛЕНИЯ

```typescript
// Expo Notifications
import * as Notifications from 'expo-notifications'

// Типы уведомлений:
// - Новое сообщение в чате
// - Ответ поставщика на заявку
// - Изменение статуса заказа
// - Изменение цены в избранном товаре

// Сохраняем токен в profiles.push_token
const token = await Notifications.getExpoPushTokenAsync()
await supabase.from('profiles').update({ push_token: token.data })
```

---

## НИЖНЯЯ НАВИГАЦИЯ (5 табов)

```
[Каталог] [Чаты 🔴] [ИИ] [Заказы] [Профиль]
```

---

## НАСТРОЙКА ПРОЕКТА

### Инициализация
```bash
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
npx expo install expo-router expo-constants expo-linking
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install expo-av expo-document-picker expo-file-system
npx expo install expo-notifications expo-secure-store
npx expo install nativewind
npm install zustand @tanstack/react-query
```

### app.json (EAS конфиг)
```json
{
  "expo": {
    "name": "МеталлПортал",
    "slug": "metallportal",
    "version": "1.0.0",
    "scheme": "metallportal",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "ru.metallportal.app",
      "supportsTablet": true
    },
    "android": {
      "package": "ru.metallportal.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon-fg.png",
        "backgroundColor": "#1a56db"
      }
    },
    "plugins": [
      "expo-router",
      "expo-av",
      [
        "expo-notifications",
        { "icon": "./assets/notification-icon.png" }
      ]
    ]
  }
}
```

### .env
```
EXPO_PUBLIC_SUPABASE_URL=https://tmzqirzyvmnkzfmotlcj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ключ из Supabase>
EXPO_PUBLIC_OPENROUTER_KEY=<ключ OpenRouter>
```

---

## ДИЗАЙН-СИСТЕМА

- Основной цвет: `#1a56db` (синий металлик)
- Акцент: `#f97316` (оранжевый — цены/акции)
- Фон светлый: `#f8fafc`
- Фон тёмный: `#0f172a`
- Поддержка тёмной темы (как на сайте)
- Шрифт: Inter (expo-font)
- Иконки: @expo/vector-icons (Ionicons)

---

## ПОРЯДОК РАЗРАБОТКИ (MVP → Полная версия)

### Sprint 1 (неделя 1-2): Фундамент
- [ ] Инициализация Expo проекта
- [ ] Expo Router (layout, табы, навигация)
- [ ] Supabase клиент + авторизация
- [ ] Глобальный стейт (Zustand: auth, cart)

### Sprint 2 (неделя 3-4): Каталог
- [ ] Список категорий L1/L2
- [ ] Карточка товара (4 таба)
- [ ] Поиск и фильтры
- [ ] Корзина

### Sprint 3 (неделя 5-7): Мессенджер
- [ ] Таблицы в Supabase (conversations, messages)
- [ ] Список чатов
- [ ] Чат (realtime, текст, статусы)
- [ ] Голосовые сообщения
- [ ] Файлы (PDF, Excel)
- [ ] Push-уведомления

### Sprint 4 (неделя 8-9): ИИ-агент
- [ ] Экран ИИ-чата
- [ ] OpenRouter интеграция + стриминг
- [ ] RAG поиск по каталогу
- [ ] Карточки товаров в ответах ИИ

### Sprint 5 (неделя 10): Профиль и заказы
- [ ] Личный кабинет покупателя
- [ ] История заказов
- [ ] Кабинет поставщика (базовый)

### Sprint 6 (неделя 11-12): Паблиш
- [ ] EAS Build (iOS + Android)
- [ ] Тестирование на устройствах
- [ ] App Store Connect + Google Play Console
- [ ] Ревью и публикация

---

## КОМАНДЫ ДЛЯ ЗАПУСКА

```bash
# Разработка
npx expo start

# iOS симулятор
npx expo run:ios

# Android эмулятор
npx expo run:android

# Сборка для App Store
eas build --platform ios --profile production

# Сборка для Google Play
eas build --platform android --profile production

# Публикация в магазины
eas submit --platform ios
eas submit --platform android
```

---

## ВАЖНЫЕ ЗАМЕТКИ

1. **Один Supabase проект** для сайта и приложения — данные синхронизированы
2. **Row Level Security (RLS)** — добавить политики для messages и conversations
3. **Голос хранится в Supabase Storage** bucket `chat-voice`, публичный URL
4. **Файлы до 50 МБ** — лимит Supabase Storage на бесплатном плане
5. **OpenRouter ключ** — тот же что для generate_cards.ts
6. **Realtime** — включить для таблиц messages и conversations в Supabase Dashboard

---

*Файл создан: 2026-04-18*  
*Проект: МеталлПортал | metallportal.vercel.app*
