import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();

  return (
    <View style={s.container}>
      <Text style={s.email}>{user?.email ?? 'Профиль'}</Text>
      <TouchableOpacity onPress={signOut} style={s.logoutBtn}>
        <Text style={s.logoutText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 24 },
  email: { fontSize: 16, color: '#0f172a', marginBottom: 32 },
  logoutBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
  logoutText: { color: '#ef4444', fontWeight: '500' },
});
