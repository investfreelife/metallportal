import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#1a56db';

interface Category { id: string; name: string; slug: string; }
interface Product {
  id: string; name: string; slug: string;
  price_items: { base_price: number; discount_price: number | null }[];
}

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [catName, setCatName] = useState('');
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: cat } = await supabase
        .from('categories').select('id,name').eq('slug', slug).single();
      if (!cat) { setLoading(false); return; }
      setCatName(cat.name);

      const [{ data: subs }, { data: prods }] = await Promise.all([
        supabase.from('categories').select('id,name,slug')
          .eq('parent_id', cat.id).eq('is_active', true).order('name'),
        supabase.from('products').select('id,name,slug,price_items(base_price,discount_price)')
          .eq('category_id', cat.id).eq('is_active', true).limit(50),
      ]);
      setSubcategories(subs ?? []);
      setProducts(prods ?? []);
      setLoading(false);
    })();
  }, [slug]);

  const getPrice = (p: Product) => {
    if (!p.price_items?.length) return null;
    return Math.min(...p.price_items.map((pi) => Number(pi.discount_price ?? pi.base_price)));
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  const hasSubs = subcategories.length > 0;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{catName}</Text>
      </View>

      <FlatList
        data={hasSubs ? subcategories : products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) =>
          hasSubs ? (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/catalog/${(item as Category).slug}` as any)}>
              <Text style={s.cardName}>{item.name}</Text>
              <Text style={s.arrow}>→</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.productCard}>
              <Text style={s.productName}>{item.name}</Text>
              {getPrice(item as Product) !== null && (
                <Text style={s.price}>
                  {Math.round(getPrice(item as Product)!).toLocaleString('ru-RU')} ₽
                </Text>
              )}
            </View>
          )
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Товаров нет</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  back: { marginBottom: 4 },
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1 },
  arrow: { fontSize: 18, color: PRIMARY },
  productCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  productName: { fontSize: 14, fontWeight: '500', color: '#0f172a', marginBottom: 6 },
  price: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
});
