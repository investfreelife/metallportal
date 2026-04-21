import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ScrollView, Alert } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '../../stores/profileStore';
import { useState, useEffect } from 'react';

const PRIMARY = '#1a56db';

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const { profile, setProfile, loadProfile, loaded } = useProfileStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => {
    if (loaded) { setName(profile.name); setPhone(profile.phone); setEmail(profile.email); }
  }, [loaded, profile]);

  const handleSave = async () => {
    await setProfile({ name, phone, email });
    setEditing(false);
    Alert.alert('Сохранено', 'Данные будут автоматически подставляться при оформлении заказа');
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}><Text style={s.title}>Профиль</Text></View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.authCard}>
          <Text style={s.authLabel}>Аккаунт</Text>
          <Text style={s.authEmail}>{user?.email}</Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Данные для заказов</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={s.editBtn}>Изменить</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.hint}>Заполните один раз — при оформлении заказа поля заполнятся автоматически</Text>

          <Text style={s.fieldLabel}>Имя</Text>
          <TextInput style={[s.field, !editing && s.fieldReadonly]} value={name} onChangeText={setName} editable={editing} placeholder="Ваше имя" />
          <Text style={s.fieldLabel}>Телефон</Text>
          <TextInput style={[s.field, !editing && s.fieldReadonly]} value={phone} onChangeText={setPhone} editable={editing} placeholder="+7 900 000 00 00" keyboardType="phone-pad" />
          <Text style={s.fieldLabel}>Email</Text>
          <TextInput style={[s.field, !editing && s.fieldReadonly]} value={email} onChangeText={setEmail} editable={editing} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />

          {editing && (
            <View style={s.saveBtns}>
              <TouchableOpacity style={s.cancelEdit} onPress={() => setEditing(false)}>
                <Text style={s.cancelEditText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveBtnText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
          <Text style={s.signOutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 24 },
  header: { backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 24, marginBottom: 16 },
  title: { fontSize: 18, color: '#fff', fontWeight: '600' },
  body: { paddingVertical: 16 },
  authCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
  authLabel: { fontSize: 14, color: '#333', marginBottom: 4 },
  authEmail: { fontSize: 16, color: '#333' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, color: '#333', fontWeight: '600' },
  editBtn: { fontSize: 14, color: PRIMARY, textDecorationLine: 'underline' },
  hint: { fontSize: 14, color: '#666', marginBottom: 16 },
  fieldLabel: { fontSize: 14, color: '#333', marginBottom: 4 },
  field: { height: 40, borderColor: '#ddd', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginBottom: 16 },
  fieldReadonly: { backgroundColor: '#f7f7f7' },
  saveBtns: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelEdit: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  cancelEditText: { fontSize: 14, color: '#333' },
  saveBtn: { backgroundColor: PRIMARY, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  signOutBtn: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, marginBottom: 16 },
  signOutText: { fontSize: 14, color: '#333' },
  logoutBtn: { borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
  logoutText: { color: '#ef4444', fontWeight: '500' },
});
