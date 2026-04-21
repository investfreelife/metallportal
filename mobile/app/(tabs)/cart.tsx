import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useCartStore } from '../../stores/cartStore';

const PRIMARY = '#1a56db';
const ACCENT = '#f97316';

export default function CartScreen() {
  const { items, removeItem, updateQty, total, clear } = useCartStore();

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

  const handleOrder = () => {
    Alert.alert(
      'Оформление заказа',
      `Итого: ${Math.round(total()).toLocaleString('ru-RU')} ₽\n\nФункция оформления будет добавлена в следующей версии.`,
      [{ text: 'OK' }]
    );
  };

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
        <TouchableOpacity style={s.orderBtn} onPress={handleOrder}>
          <Text style={s.orderBtnText}>Оформить заказ</Text>
        </TouchableOpacity>
      </View>
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
  totalLabel: { fontSize: 16, color: '#64748b' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  orderBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
