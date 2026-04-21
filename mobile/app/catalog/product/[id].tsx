import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useCartStore } from '../../../stores/cartStore';

const PRIMARY = '#1a56db';
const ACCENT = '#f97316';

interface Product {
  id: string; name: string; description: string | null;
  image_url: string | null; unit: string | null;
  material: string | null; dimensions: string | null;
  weight_per_unit: number | null; gost: string | null;
  article: string | null; min_order: number | null;
}
interface PriceItem {
  id: string; base_price: number; discount_price: number | null;
  min_quantity: number | null; in_stock: boolean; delivery_days: number | null;
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const addToCart = useCartStore((s) => s.addItem);
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('products').select('id,name,description,image_url,unit,material,dimensions,weight_per_unit,gost,article,min_order').eq('id', id).single(),
      supabase.from('price_items').select('id,base_price,discount_price,min_quantity,in_stock,delivery_days').eq('product_id', id).eq('in_stock', true).order('base_price'),
    ]).then(([{ data: p }, { data: pi }]) => {
      setProduct(p);
      setPrices(pi ?? []);
      if (p?.min_order) setQty(p.min_order);
      setLoading(false);
    });
  }, [id]);

  const bestPrice = prices[0];
  const price = bestPrice ? Number(bestPrice.discount_price ?? bestPrice.base_price) : null;

  const handleAddToCart = () => {
    if (!product || !bestPrice || price === null) return;
    addToCart({ id: bestPrice.id, productId: product.id, name: product.name, price, unit: product.unit ?? 'шт', qty });
    Alert.alert('Добавлено', `${product.name} в корзине`);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  if (!product) return <View style={s.center}><Text>Товар не найден</Text></View>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.backText}>← Назад</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={s.image} resizeMode="contain" />
        ) : (
          <View style={s.imagePlaceholder}><Text style={s.imagePlaceholderText}>Фото</Text></View>
        )}

        <View style={s.body}>
          <Text style={s.name}>{product.name}</Text>
          {product.article && <Text style={s.article}>Арт: {product.article}</Text>}

          {price !== null && (
            <View style={s.priceRow}>
              <Text style={s.price}>{Math.round(price).toLocaleString('ru-RU')} ₽</Text>
              <Text style={s.unit}>/ {product.unit ?? 'шт'}</Text>
            </View>
          )}
          {bestPrice?.in_stock && <Text style={s.inStock}>✓ В наличии</Text>}
          {bestPrice?.delivery_days && <Text style={s.delivery}>Доставка: {bestPrice.delivery_days} дн.</Text>}

          {(product.material || product.dimensions || product.gost || product.weight_per_unit) && (
            <View style={s.specs}>
              <Text style={s.specsTitle}>Характеристики</Text>
              {product.material && <SpecRow label="Материал" value={product.material} />}
              {product.dimensions && <SpecRow label="Размеры" value={product.dimensions} />}
              {product.weight_per_unit && <SpecRow label="Вес" value={`${product.weight_per_unit} кг`} />}
              {product.gost && <SpecRow label="ГОСТ" value={product.gost} />}
              {product.min_order && <SpecRow label="Мин. заказ" value={`${product.min_order} ${product.unit ?? 'шт'}`} />}
            </View>
          )}

          {product.description && (
            <View style={s.descBlock}>
              <Text style={s.specsTitle}>Описание</Text>
              <Text style={s.desc}>{product.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {price !== null && (
        <View style={s.footer}>
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(Math.max(product.min_order ?? 1, qty - 1))}>
              <Text style={s.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.qtyVal}>{qty} {product.unit ?? 'шт'}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(qty + 1)}>
              <Text style={s.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.cartBtn} onPress={handleAddToCart}>
            <Text style={s.cartBtnText}>В корзину — {Math.round(price * qty).toLocaleString('ru-RU')} ₽</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.specRow}>
      <Text style={s.specLabel}>{label}</Text>
      <Text style={s.specValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backText: { fontSize: 14, color: PRIMARY },
  scroll: { paddingBottom: 120 },
  image: { width: '100%', height: 220, backgroundColor: '#f1f5f9' },
  imagePlaceholder: { width: '100%', height: 180, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#94a3b8', fontSize: 14 },
  body: { padding: 20 },
  name: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  article: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 6 },
  price: { fontSize: 26, fontWeight: '800', color: PRIMARY },
  unit: { fontSize: 14, color: '#64748b' },
  inStock: { fontSize: 13, color: '#22c55e', marginBottom: 2 },
  delivery: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  specs: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 },
  specsTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  specLabel: { fontSize: 13, color: '#64748b', flex: 1 },
  specValue: { fontSize: 13, fontWeight: '500', color: '#0f172a', flex: 1, textAlign: 'right' },
  descBlock: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  desc: { fontSize: 14, color: '#475569', lineHeight: 22 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', gap: 12 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 20, color: PRIMARY },
  qtyVal: { fontSize: 16, fontWeight: '600', color: '#0f172a', minWidth: 60, textAlign: 'center' },
  cartBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
