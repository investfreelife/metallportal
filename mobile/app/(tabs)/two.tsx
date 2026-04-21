import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useOrdersStore } from '../../stores/ordersStore';

const PRIMARY = '#1a56db';

const STATUS_LABEL: Record<string, string> = {
  new: 'Новый', processing: 'В работе', shipped: 'Отправлен', done: 'Выполнен', cancelled: 'Отменён',
};
const STATUS_COLOR: Record<string, string> = {
  new: '#f97316', processing: '#1a56db', shipped: '#8b5cf6', done: '#22c55e', cancelled: '#ef4444',
};

export default function OrdersScreen() {
  const { orders } = useOrdersStore();

  if (orders.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}><Text style={s.headerTitle}>Мои заказы</Text></View>
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyText}>Заказов пока нет</Text>
          <Text style={s.emptyHint}>Оформите заказ через корзину</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}><Text style={s.headerTitle}>Мои заказы</Text></View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.orderId}>Заказ {item.orderId ? `#${item.orderId.slice(0, 8)}` : `от ${new Date(item.createdAt).toLocaleDateString('ru-RU')}`}</Text>
              <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[item.status] ?? '#94a3b8') + '20' }]}>
                <Text style={[s.statusText, { color: STATUS_COLOR[item.status] ?? '#94a3b8' }]}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text style={s.date}>{new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
            {item.items.slice(0, 2).map((i) => (
              <Text key={i.id} style={s.itemLine} numberOfLines={1}>• {i.name} — {i.qty} {i.unit}</Text>
            ))}
            {item.items.length > 2 && <Text style={s.moreItems}>ещё {item.items.length - 2} поз.</Text>}
            <Text style={s.total}>{Math.round(item.total).toLocaleString('ru-RU')} ₽</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#0f172a' },
  emptyHint: { fontSize: 14, color: '#94a3b8' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderId: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  date: { fontSize: 12, color: '#94a3b8', marginBottom: 10 },
  itemLine: { fontSize: 13, color: '#475569', marginBottom: 2 },
  moreItems: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  total: { fontSize: 17, fontWeight: '800', color: PRIMARY, marginTop: 8 },
});
