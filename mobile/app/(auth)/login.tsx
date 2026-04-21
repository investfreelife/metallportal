import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StyleSheet, Linking,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://metallportal.vercel.app';

const PRIMARY = '#1a56db';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Ошибка', 'Введите email и пароль'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Ошибка входа', error.message);
  };

  const handleTelegramLogin = async () => {
    setTgLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/telegram/mobile-auth`, { method: 'POST' });
      const { code, deep_link } = await res.json();
      await Linking.openURL(deep_link);

      // Поллинг каждые 2 сек, максимум 5 минут
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 150) {
          clearInterval(pollRef.current!);
          setTgLoading(false);
          return;
        }
        const r = await fetch(`${API_URL}/api/telegram/mobile-auth?code=${code}`);
        const data = await r.json();
        if (data.status === 'confirmed' && data.access_token) {
          clearInterval(pollRef.current!);
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          setTgLoading(false);
        } else if (data.status === 'expired') {
          clearInterval(pollRef.current!);
          setTgLoading(false);
          Alert.alert('Время вышло', 'Попробуйте снова');
        }
      }, 2000);
    } catch {
      setTgLoading(false);
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
      <View style={s.inner}>
        <View style={s.logoBlock}>
          <Text style={s.logoText}>МеталлПортал</Text>
          <Text style={s.logoSub}>Маркетплейс металлопроката</Text>
        </View>
        <View style={s.fieldWrap}>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} placeholder="your@email.com" value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </View>
        <View style={s.fieldWrapLast}>
          <Text style={s.label}>Пароль</Text>
          <TextInput style={s.input} placeholder="••••••••" value={password}
            onChangeText={setPassword} secureTextEntry />
        </View>
        {/* Telegram Login */}
        <TouchableOpacity style={s.tgBtn} onPress={handleTelegramLogin} disabled={tgLoading}>
          {tgLoading ? (
            <View style={s.tgBtnInner}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.tgBtnText}>Ожидаем подтверждения...</Text>
            </View>
          ) : (
            <View style={s.tgBtnInner}>
              <Text style={s.tgIcon}>✈️</Text>
              <Text style={s.tgBtnText}>Войти через Telegram</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>или по email</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Войти по email</Text>}
        </TouchableOpacity>
        <View style={s.footer}>
          <Text style={s.footerText}>Нет аккаунта? </Text>
          <Link href="/(auth)/register"><Text style={s.link}>Зарегистрироваться</Text></Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoBlock: { marginBottom: 40 },
  logoText: { fontSize: 28, fontWeight: '700', color: PRIMARY },
  logoSub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldWrapLast: { marginBottom: 24 },
  label: { fontSize: 13, color: '#475569', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
  tgBtn: { backgroundColor: '#229ED9', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  tgBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tgIcon: { fontSize: 18 },
  tgBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 13, color: '#94a3b8' },
  btn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#64748b' },
  link: { color: PRIMARY, fontWeight: '500' },
});
