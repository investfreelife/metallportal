import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, SafeAreaView, TextInput,
  ImageBackground, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const PRIMARY = '#1a56db';
const ACCENT = '#f97316';
const { width: W } = Dimensions.get('window');

const CATEGORY_ICONS: Record<string, string> = {
  'metalloprokat': '🏗️',
  'gotovye-konstruktsii': '🏠',
  'truby-stalnye': '🔩',
  'listovoy-prokat': '📄',
  'fasonnyy-prokat': '⚙️',
  'armatura': '🔧',
  'navesy': '⛺',
  'metizy': '🔩',
  'default': '📦',
};

const QUICK_CATEGORIES = [
  { slug: 'truby-stalnye', name: 'Трубы', icon: '🔩' },
  { slug: 'armatura', name: 'Арматура', icon: '🔧' },
  { slug: 'listovoy-prokat', name: 'Листы', icon: '📄' },
  { slug: 'ugolok', name: 'Уголок', icon: '📐' },
  { slug: 'dvutavr', name: 'Двутавр', icon: '⚙️' },
  { slug: 'truba-profilnaya', name: 'Профиль', icon: '🏗️' },
];

interface Category { id: string; name: string; slug: string; parent_id: string | null; }

export default function CatalogScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('categories').select('id,name,slug,parent_id')
      .eq('is_active', true).is('parent_id', null).order('name')
      .then(({ data }) => { setCategories(data ?? []); setLoading(false); });
  }, []);

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={() => (
          <View>
            {/* Hero banner */}
            <View style={s.hero}>
              <View style={s.heroBadge}><Text style={s.heroBadgeText}>🔥 Лучшие цены</Text></View>
              <Text style={s.heroTitle}>МеталлПортал</Text>
              <Text style={s.heroSub}>12 000+ товаров металлопроката{'\n'}от поставщиков по всей России</Text>
              <View style={s.heroStats}>
                <View style={s.heroStat}><Text style={s.heroStatNum}>12K+</Text><Text style={s.heroStatLabel}>товаров</Text></View>
                <View style={s.heroStatDiv} />
                <View style={s.heroStat}><Text style={s.heroStatNum}>50+</Text><Text style={s.heroStatLabel}>брендов</Text></View>
                <View style={s.heroStatDiv} />
                <View style={s.heroStat}><Text style={s.heroStatNum}>1 день</Text><Text style={s.heroStatLabel}>доставка</Text></View>
              </View>
            </View>

            {/* Search */}
            <View style={s.searchWrap}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder="Поиск по каталогу..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Quick access */}
            {!search && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Популярные разделы</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
                  {QUICK_CATEGORIES.map((q) => (
                    <TouchableOpacity key={q.slug} style={s.quickCard} onPress={() => router.push(`/catalog/${q.slug}` as any)}>
                      <Text style={s.quickIcon}>{q.icon}</Text>
                      <Text style={s.quickName}>{q.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={s.sectionTitle2}>Все категории</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => router.push(`/catalog/${item.slug}` as any)}>
            <View style={s.cardIcon}>
              <Text style={s.cardIconText}>{CATEGORY_ICONS[item.slug] ?? CATEGORY_ICONS['default']}</Text>
            </View>
            <Text style={s.cardName}>{item.name}</Text>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    backgroundColor: PRIMARY, marginHorizontal: 0, paddingHorizontal: 24,
    paddingTop: 28, paddingBottom: 28,
  },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20, marginBottom: 20 },
  heroStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 14 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatNum: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroStatDiv: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.3)' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, borderRadius: 14, paddingHorizontal: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#0f172a' },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle2: { fontSize: 16, fontWeight: '700', color: '#0f172a', paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  quickRow: { paddingHorizontal: 16, gap: 10 },
  quickCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', width: 80, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  quickIcon: { fontSize: 26, marginBottom: 6 },
  quickName: { fontSize: 11, fontWeight: '600', color: '#475569', textAlign: 'center' },

  list: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardIconText: { fontSize: 22 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1 },
  arrow: { fontSize: 22, color: '#94a3b8' },
});
