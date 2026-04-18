import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { Link } from 'expo-router'
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
                    {r === 'buyer' ? 'Покупатель' : 'Поставщик'}
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
