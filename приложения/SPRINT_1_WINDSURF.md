# ЗАДАНИЕ ДЛЯ WINDSURF: Sprint 1 — МеталлПортал Mobile

## Контекст
Создаём мобильное приложение для маркетплейса металлопроката metallportal.vercel.app.
Существующий сайт: Next.js 14 + Supabase (project id: tmzqirzyvmnkzfmotlcj).
Приложение — отдельная папка `mobile/` в корне того же репозитория.

---

## ЧТО НУЖНО СДЕЛАТЬ (Sprint 1)

### Шаг 1: Инициализация проекта

```bash
# В корне репозитория metallportal
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
```

### Шаг 2: Установка зависимостей

```bash
npx expo install expo-router expo-constants expo-linking expo-status-bar expo-splash-screen
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
npx expo install expo-secure-store expo-local-authentication
npm install zustand
npm install nativewind tailwindcss
npx tailwindcss init
```

### Шаг 3: Конфигурация файлов

**`mobile/app.json`** — заменить целиком:
```json
{
  "expo": {
    "name": "МеталлПортал",
    "slug": "metallportal",
    "version": "1.0.0",
    "scheme": "metallportal",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "platforms": ["ios", "android"],
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a56db"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "ru.metallportal.app"
    },
    "android": {
      "package": "ru.metallportal.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a56db"
      }
    },
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

**`mobile/package.json`** — добавить в корень объекта:
```json
"main": "expo-router/entry"
```

**`mobile/tailwind.config.js`** — заменить целиком:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1a56db",
        accent: "#f97316",
        dark: "#0f172a",
      }
    }
  },
  plugins: [],
}
```

**`mobile/babel.config.js`** — заменить целиком:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

**`mobile/.env`** — создать:
```
EXPO_PUBLIC_SUPABASE_URL=https://tmzqirzyvmnkzfmotlcj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=ВСТАВИТЬ_КЛЮЧ_ИЗ_SUPABASE_DASHBOARD
```

---

### Шаг 4: Структура папок

Создать следующую структуру:
```
mobile/
├── app/
│   ├── _layout.tsx              ← корневой layout
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── _layout.tsx          ← нижняя навигация
│       ├── index.tsx            ← Каталог (главная)
│       ├── chat.tsx             ← Чаты
│       ├── ai.tsx               ← ИИ-агент
│       ├── orders.tsx           ← Заказы
│       └── profile.tsx          ← Профиль
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── LoadingScreen.tsx
├── lib/
│   ├── supabase.ts
│   └── auth.ts
├── stores/
│   ├── authStore.ts
│   └── cartStore.ts
└── types/
    └── index.ts
```

---

### Шаг 5: Supabase клиент

**`mobile/lib/supabase.ts`**:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

---

### Шаг 6: Zustand — authStore

**`mobile/stores/authStore.ts`**:
```typescript
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
  phone: string | null
  role: 'buyer' | 'supplier'
  avatar_url: string | null
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
    loading: false,
  }),

  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) set({ profile: data })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },
}))
```

**`mobile/stores/cartStore.ts`**:
```typescript
import { create } from 'zustand'

interface CartItem {
  productId: string
  name: string
  article: string
  quantity: number
  unit: string
  price: number | null
  supplierId: string
}

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
  total: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item) => set((state) => {
    const exists = state.items.find(i => i.productId === item.productId)
    if (exists) {
      return { items: state.items.map(i =>
        i.productId === item.productId
          ? { ...i, quantity: i.quantity + item.quantity }
          : i
      )}
    }
    return { items: [...state.items, item] }
  }),

  removeItem: (productId) => set((state) => ({
    items: state.items.filter(i => i.productId !== productId)
  })),

  updateQuantity: (productId, quantity) => set((state) => ({
    items: state.items.map(i =>
      i.productId === productId ? { ...i, quantity } : i
    )
  })),

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((sum, item) =>
    sum + (item.price ?? 0) * item.quantity, 0
  ),
}))
```

---

### Шаг 7: Корневой Layout с авторизацией

**`mobile/app/_layout.tsx`**:
```typescript
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export default function RootLayout() {
  const { setSession, fetchProfile } = useAuthStore()

  useEffect(() => {
    // Восстанавливаем сессию при запуске
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
    })

    // Слушаем изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) fetchProfile(session.user.id)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}
```

---

### Шаг 8: Auth Layout с редиректом

**`mobile/app/(auth)/_layout.tsx`**:
```typescript
import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'

export default function AuthLayout() {
  const { session, loading } = useAuthStore()

  if (loading) return null
  if (session) return <Redirect href="/(tabs)" />

  return <Stack screenOptions={{ headerShown: false }} />
}
```

---

### Шаг 9: Tabs Layout с нижней навигацией

**`mobile/app/(tabs)/_layout.tsx`**:
```typescript
import { Tabs, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../stores/authStore'

export default function TabsLayout() {
  const { session, loading } = useAuthStore()

  if (loading) return null
  if (!session) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1a56db',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Каталог',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Чаты',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'ИИ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заказы',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
```

---

### Шаг 10: Экран Login

**`mobile/app/(auth)/login.tsx`**:
```typescript
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) Alert.alert('Ошибка входа', error.message)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        {/* Логотип */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-primary">МеталлПортал</Text>
          <Text className="text-slate-500 mt-1">Маркетплейс металлопроката</Text>
        </View>

        {/* Email */}
        <View className="mb-4">
          <Text className="text-sm text-slate-600 mb-1">Email</Text>
          <TextInput
            className="border border-slate-300 rounded-xl px-4 py-3 text-base"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Пароль */}
        <View className="mb-6">
          <Text className="text-sm text-slate-600 mb-1">Пароль</Text>
          <TextInput
            className="border border-slate-300 rounded-xl px-4 py-3 text-base"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* Кнопка входа */}
        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-semibold text-base">Войти</Text>
          }
        </TouchableOpacity>

        {/* Регистрация */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-500">Нет аккаунта? </Text>
          <Link href="/(auth)/register">
            <Text className="text-primary font-medium">Зарегистрироваться</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
```

---

### Шаг 11: Экран Register

**`mobile/app/(auth)/register.tsx`**:
```typescript
import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { Link, router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'buyer' | 'supplier'>('buyer')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Ошибка', 'Заполните все поля')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setLoading(false)
      Alert.alert('Ошибка', error.message)
      return
    }
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: fullName,
        role,
      })
    }
    setLoading(false)
    Alert.alert('Готово', 'Проверьте email для подтверждения')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-10">
          <View className="mb-8">
            <Text className="text-2xl font-bold text-dark">Регистрация</Text>
          </View>

          {/* Роль */}
          <View className="mb-6">
            <Text className="text-sm text-slate-600 mb-2">Я являюсь</Text>
            <View className="flex-row gap-3">
              {(['buyer', 'supplier'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  className={`flex-1 py-3 rounded-xl border items-center ${
                    role === r
                      ? 'bg-primary border-primary'
                      : 'border-slate-300'
                  }`}
                >
                  <Text className={role === r ? 'text-white font-medium' : 'text-slate-600'}>
                    {r === 'buyer' ? '🛒 Покупатель' : '🏭 Поставщик'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm text-slate-600 mb-1">Имя / Компания</Text>
            <TextInput
              className="border border-slate-300 rounded-xl px-4 py-3 text-base"
              placeholder="ООО Металл Сервис"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-slate-600 mb-1">Email</Text>
            <TextInput
              className="border border-slate-300 rounded-xl px-4 py-3 text-base"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm text-slate-600 mb-1">Пароль</Text>
            <TextInput
              className="border border-slate-300 rounded-xl px-4 py-3 text-base"
              placeholder="Минимум 6 символов"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-semibold text-base">Создать аккаунт</Text>
            }
          </TouchableOpacity>

          <View className="flex-row justify-center mt-6">
            <Text className="text-slate-500">Уже есть аккаунт? </Text>
            <Link href="/(auth)/login">
              <Text className="text-primary font-medium">Войти</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
```

---

### Шаг 12: Заглушки для табов

Создать файлы-заглушки (будут реализованы в следующих спринтах):

**`mobile/app/(tabs)/index.tsx`** (Каталог):
```typescript
import { View, Text } from 'react-native'
export default function CatalogScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-xl font-bold text-dark">📦 Каталог</Text>
      <Text className="text-slate-500 mt-2">Sprint 2</Text>
    </View>
  )
}
```

**`mobile/app/(tabs)/chat.tsx`** (Чаты):
```typescript
import { View, Text } from 'react-native'
export default function ChatScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-xl font-bold text-dark">💬 Чаты</Text>
      <Text className="text-slate-500 mt-2">Sprint 3</Text>
    </View>
  )
}
```

**`mobile/app/(tabs)/ai.tsx`** (ИИ):
```typescript
import { View, Text } from 'react-native'
export default function AIScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-xl font-bold text-dark">✨ ИИ-агент</Text>
      <Text className="text-slate-500 mt-2">Sprint 4</Text>
    </View>
  )
}
```

**`mobile/app/(tabs)/orders.tsx`** (Заказы):
```typescript
import { View, Text } from 'react-native'
export default function OrdersScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-xl font-bold text-dark">📋 Заказы</Text>
      <Text className="text-slate-500 mt-2">Sprint 5</Text>
    </View>
  )
}
```

**`mobile/app/(tabs)/profile.tsx`** (Профиль):
```typescript
import { View, Text, TouchableOpacity } from 'react-native'
import { useAuthStore } from '../../stores/authStore'

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()

  return (
    <View className="flex-1 items-center justify-center bg-slate-50 px-6">
      <Text className="text-xl font-bold text-dark mb-2">
        {profile?.full_name ?? 'Профиль'}
      </Text>
      <Text className="text-slate-500 mb-8">
        {profile?.role === 'supplier' ? '🏭 Поставщик' : '🛒 Покупатель'}
      </Text>
      <TouchableOpacity
        onPress={signOut}
        className="border border-red-300 rounded-xl px-8 py-3"
      >
        <Text className="text-red-500 font-medium">Выйти</Text>
      </TouchableOpacity>
    </View>
  )
}
```

---

### Шаг 13: SQL — таблица profiles в Supabase

Выполнить в Supabase SQL Editor:

```sql
-- Таблица профилей
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'buyer' CHECK (role IN ('buyer', 'supplier')),
  avatar_url TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Пользователь видит свой профиль"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Пользователь обновляет свой профиль"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Пользователь создаёт свой профиль"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### Шаг 14: Проверка и запуск

```bash
cd mobile
npx expo start
# Открыть на iOS симуляторе или через Expo Go на телефоне
```

**Что должно работать после Sprint 1:**
- ✅ Приложение запускается
- ✅ Экран Login/Register
- ✅ Авторизация через Supabase
- ✅ После входа → 5 табов (заглушки)
- ✅ Профиль показывает имя из БД
- ✅ Кнопка "Выйти" работает
- ✅ Сессия сохраняется при перезапуске

---

## ПОСЛЕ ЗАВЕРШЕНИЯ

1. Закоммитить: `git add -A && git commit -m "feat: mobile Sprint 1 - Expo + Auth + Zustand" && git push`
2. Обновить `START_HERE.md` — отметить Sprint 1 как выполненный
3. Сообщить что готово для Sprint 2 (Каталог)
