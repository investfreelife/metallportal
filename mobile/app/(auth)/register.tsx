import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, StyleSheet
} from 'react-native'
import { Link } from 'expo-router'
import { supabase } from '../../lib/supabase'

const PRIMARY = '#1a56db'

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
      style={s.container}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.inner}>
          <View style={s.titleBlock}>
            <Text style={s.title}>Регистрация</Text>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Я являюсь</Text>
            <View style={s.roleRow}>
              {(['buyer', 'supplier'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={[s.roleBtn, role === r && s.roleBtnActive]}
                >
                  <Text style={role === r ? s.roleTxtActive : s.roleTxt}>
                    {r === 'buyer' ? 'Покупатель' : 'Поставщик'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Имя / Компания</Text>
            <TextInput
              style={s.input}
              placeholder="ООО Металл Сервис"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={s.fieldWrapLast}>
            <Text style={s.label}>Пароль</Text>
            <TextInput
              style={s.input}
              placeholder="Минимум 6 символов"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={s.btnText}>Создать аккаунт</Text>
            }
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={s.footerText}>Уже есть аккаунт? </Text>
            <Link href="/(auth)/login">
              <Text style={s.link}>Войти</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  titleBlock: { marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  fieldWrap: { marginBottom: 16 },
  fieldWrapLast: { marginBottom: 24 },
  label: { fontSize: 13, color: '#475569', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
  },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center',
  },
  roleBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  roleTxt: { color: '#475569' },
  roleTxtActive: { color: '#fff', fontWeight: '500' },
  btn: {
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#64748b' },
  link: { color: PRIMARY, fontWeight: '500' },
})
