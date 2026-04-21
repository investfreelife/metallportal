import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#1a56db';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Ошибка', 'Введите email и пароль'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Ошибка входа', error.message);
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
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Войти</Text>}
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
  btn: { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#64748b' },
  link: { color: PRIMARY, fontWeight: '500' },
});
