import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert, TextInput, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useCartStore } from '../../stores/cartStore';
import { useOrdersStore } from '../../stores/ordersStore';

const PRIMARY = '#1a56db';
const ACCENT = '#f97316';
const API_URL = 'https://metallportal.ru/api/orders';

export default function CartScreen() {
  const { items, removeItem, updateQty, total, clear } = useCartStore();
  const addOrder = useOrdersStore((s) => s.addOrder);
  const [showCheckout, setShowCheckout] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitOrder = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Ошибка', 'Введите имя и телефон'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone, email, comment,
          items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, unit: i.unit })),
        }),
      });
      const json = await res.json();
      addOrder({
        localId: Date.now().toString(),
        orderId: json.orderId ?? null,
        customerName: name, customerPhone: phone, customerEmail: email,
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, unit: i.unit })),
        total: total(), status: 'new', createdAt: new Date().toISOString(),
      });
      clear();
      setShowCheckout(false);
      setName(''); setPhone(''); setEmail(''); setComment('');
      Alert.alert('Заказ принят!', `Номер заказа: ${json.orderId ?? '—'}\nМы свяжемся с вами по номеру ${phone}`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить заказ. Проверьте интернет.');
    }
    setSubmitting(false);
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}><Text style={s.headerTitle}>Корзина</Text></View>
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🛒</Text>
          <Text style={s.emptyText}>Корзина пуста</Text>
          <Text style={s.emptyHint}>Добавьте товары из каталога</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Корзина</Text>
        <TouchableOpacity onPress={() => Alert.alert('Очистить?', '', [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Да', onPress: clear, style: 'destructive' },
        ])}>
          <Text style={s.clearBtn}>Очистить</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
              <TouchableOpacity onPress={() => removeItem(item.id)}>
                <Text style={s.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.cardBottom}>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, item.qty - 1)}>
                  <Text style={s.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={s.qtyVal}>{item.qty} {item.unit}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, item.qty + 1)}>
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.itemPrice}>
                {Math.round(item.price * item.qty).toLocaleString('ru-RU')} ₽
              </Text>
            </View>
          </View>
        )}
      />

      <View style={s.footer}>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Итого:</Text>
          <Text style={s.totalValue}>{Math.round(total()).toLocaleString('ru-RU')} ₽</Text>
        </View>
        <TouchableOpacity style={s.orderBtn} onPress={() => setShowCheckout(true)}>
          <Text style={s.orderBtnText}>Оформить заказ</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCheckout} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Оформление заказа</Text>
            <TouchableOpacity onPress={() => setShowCheckout(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody}>
            <Text style={s.fieldLabel}>Имя *</Text>
            <TextInput style={s.fieldInput} placeholder="Иван Иванов" value={name} onChangeText={setName} />
            <Text style={s.fieldLabel}>Телефон *</Text>
            <TextInput style={s.fieldInput} placeholder="+7 900 000 00 00" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput style={s.fieldInput} placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.fieldLabel}>Комментарий</Text>
            <TextInput style={[s.fieldInput, s.fieldTextarea]} placeholder="Пожелания к заказу..." value={comment} onChangeText={setComment} multiline numberOfLines={3} />
            <View style={s.modalTotal}>
              <Text style={s.modalTotalLabel}>Итого:</Text>
              <Text style={s.modalTotalValue}>{Math.round(total()).toLocaleString('ru-RU')} ₽</Text>
            </View>
            <TouchableOpacity style={[s.orderBtn, submitting && s.orderBtnDisabled]} onPress={handleSubmitOrder} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.orderBtnText}>Отправить заказ</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  clearBtn: { fontSize: 14, color: '#ef4444' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  emptyHint: { fontSize: 14, color: '#94a3b8' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#0f172a', flex: 1, marginRight: 8 },
  removeBtn: { fontSize: 16, color: '#94a3b8' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: PRIMARY, lineHeight: 22 },
  qtyVal: { fontSize: 14, fontWeight: '500', color: '#0f172a', minWidth: 50, textAlign: 'center' },
  itemPrice: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  modalClose: { fontSize: 20, color: '#94a3b8' },
  modalBody: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 13, color: '#475569', marginBottom: 4, marginTop: 12 },
  fieldInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  fieldTextarea: { height: 80, textAlignVertical: 'top' },
  modalTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 4 },
  modalTotalLabel: { fontSize: 16, color: '#64748b' },
  modalTotalValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  orderBtnDisabled: { opacity: 0.6 },
  totalLabel: { fontSize: 16, color: '#64748b' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  orderBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
