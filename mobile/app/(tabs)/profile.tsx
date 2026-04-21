import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useAuthStore } from '../../stores/authStore'

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()

  return (
    <View style={s.container}>
      <Text style={s.name}>{profile?.full_name ?? 'Профиль'}</Text>
      <Text style={s.role}>
        {profile?.role === 'supplier' ? 'Поставщик' : 'Покупатель'}
      </Text>
      <TouchableOpacity onPress={signOut} style={s.logoutBtn}>
        <Text style={s.logoutText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 24 },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  role: { fontSize: 14, color: '#64748b', marginBottom: 32 },
  logoutBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
  logoutText: { color: '#ef4444', fontWeight: '500' },
})
