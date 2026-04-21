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
