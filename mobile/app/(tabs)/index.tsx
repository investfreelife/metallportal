import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, StyleSheet, SafeAreaView, TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '../../lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

const PRIMARY = '#1a56db';
const ACCENT = '#f97316';

const CATEGORY_ICONS: Record<string, string> = {
  'metalloprokat': '🏗️', 'gotovye-konstruktsii': '🏠', 'truby-stalnye': '🔩',
  'listovoy-prokat': '📄', 'fasonnyy-prokat': '⚙️', 'armatura': '🔧',
  'navesy': '⛺', 'metizy': '🔩', 'default': '📦',
};

const BANNERS = [
  {
    id: '1',
    title: 'Металлопрокат\nоптом и в розницу',
    subtitle: 'От склада в Москве. Доставка за 1 день',
    badge: '🔥 Горячие цены',
    bg: ['#1a56db', '#1e40af'],
    cta: 'Смотреть каталог',
    slug: null,
  },
  {
    id: '2',
    title: 'Трубы стальные\nот 2 990 ₽/т',
    subtitle: 'ГОСТ 8732, 8734. Широкий выбор диаметров',
    badge: '📦 В наличии',
    bg: ['#0f766e', '#0d9488'],
    cta: 'К трубам',
    slug: 'truby-stalnye',
  },
  {
    id: '3',
    title: 'Арматура А500С\nот 1 день',
    subtitle: 'Диаметр 8–32 мм. Кратность от 1 прутка',
    badge: '⚡ Быстрая отгрузка',
    bg: ['#b45309', '#d97706'],
    cta: 'К арматуре',
    slug: 'armatura',
  },
  {
    id: '4',
    title: 'Листовой прокат\nХК, ГК, оцинковка',
    subtitle: 'Резка в размер. Отгрузка от 1 листа',
    badge: '✂️ Резка в размер',
    bg: ['#6d28d9', '#7c3aed'],
    cta: 'Смотреть листы',
    slug: 'listovoy-prokat',
  },
];

const QUICK_CATEGORIES = [
  { slug: 'truby-stalnye', name: 'Трубы', icon: '🔩' },
  { slug: 'armatura', name: 'Арматура', icon: '🔧' },
  { slug: 'listovoy-prokat', name: 'Листы', icon: '📄' },
  { slug: 'ugolok', name: 'Уголок', icon: '📐' },
  { slug: 'dvutavr', name: 'Двутавр', icon: '⚙️' },
  { slug: 'truba-profilnaya', name: 'Профиль', icon: '🏗️' },
];

interface Category { id: string; name: string; slug: string; parent_id: string | null; }
interface SearchResult {
  id: string; name: string; slug: string; image_url: string | null;
  unit: string; categoryName: string; price: number | null;
}

function BannerCarousel({ onSlugPress }: { onSlugPress: (slug: string | null) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (activeRef.current + 1) % BANNERS.length;
      activeRef.current = next;
      setActive(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const onScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    activeRef.current = idx;
    setActive(idx);
  }, []);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
      >
        {BANNERS.map((b) => (
          <TouchableOpacity
            key={b.id}
            activeOpacity={0.95}
            style={[cs.banner, { width: SCREEN_W, backgroundColor: b.bg[0] }]}
            onPress={() => onSlugPress(b.slug)}
          >
            <View style={cs.bannerBadge}><Text style={cs.bannerBadgeText}>{b.badge}</Text></View>
            <Text style={cs.bannerTitle}>{b.title}</Text>
            <Text style={cs.bannerSub}>{b.subtitle}</Text>
            <View style={cs.bannerCta}>
              <Text style={cs.bannerCtaText}>{b.cta} →</Text>
            </View>
            <View style={[cs.bannerCircle1, { backgroundColor: b.bg[1] }]} />
            <View style={[cs.bannerCircle2, { backgroundColor: b.bg[1] }]} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={cs.dots}>
        {BANNERS.map((_, i) => (
          <View key={i} style={[cs.dot, active === i && cs.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function SearchBar({ value, onChange, searching }: {
  value: string; onChange: (t: string) => void; searching: boolean;
}) {
  return (
    <View style={s.searchWrap}>
      <Text style={s.searchIcon}>🔍</Text>
      <TextInput
        style={s.searchInput}
        placeholder="Поиск по каталогу..."
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChange}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {searching && <ActivityIndicator size="small" color={PRIMARY} />}
    </View>
  );
}

export default function CatalogScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.from('categories').select('id,name,slug,parent_id')
      .eq('is_active', true).is('parent_id', null).order('name')
      .then(({ data }) => { setCategories(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const words = search.trim().split(/\s+/).filter(w => w.length > 0);
        let query = supabase
          .from('products')
          .select('id,name,slug,image_url,unit,category_id,price_items(base_price,discount_price)')
          .eq('is_active', true)
          .limit(30)
          .order('name');

        if (words.length === 1) {
          query = query.ilike('name', `%${words[0]}%`);
        } else {
          words.forEach(w => { query = query.ilike('name', `%${w}%`); });
        }

        const [{ data: products }, { data: categories }] = await Promise.all([
          query,
          supabase.from('categories').select('id,name,slug,parent_id').eq('is_active', true).limit(300),
        ]);

        const catMap: Record<string, any> = Object.fromEntries(
          (categories ?? []).map(c => [c.id, c])
        );

        const results: SearchResult[] = (products ?? []).map(p => {
          const cat = catMap[p.category_id];
          const pi = Array.isArray(p.price_items) && p.price_items.length ? p.price_items[0] : null;
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            image_url: p.image_url ?? null,
            unit: p.unit ?? 'т',
            categoryName: cat?.name ?? '',
            price: pi ? Math.round(Number(pi.discount_price ?? pi.base_price)) : null,
          };
        });

        setSearchResults(results);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }, [search]);

  const isSearching = search.length >= 2;

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  return (
    <SafeAreaView style={s.container}>
      {/* Search bar — always mounted, never unmounts */}
      <View style={s.searchHeader}>
        <SearchBar value={search} onChange={setSearch} searching={searching} />
        {isSearching && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.cancelBtn}>
            <Text style={s.cancelText}>Отмена</Text>
          </TouchableOpacity>
        )}
      </View>

      {isSearching ? (
        searching ? (
          <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>Ничего не найдено</Text></View>}
            ListHeaderComponent={searchResults.length > 0
              ? <Text style={s.sectionTitle2}>Найдено: {searchResults.length} товаров</Text>
              : null}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.searchCard} onPress={() => router.push(`/catalog/product/${item.id}` as any)}>
                {item.image_url
                  ? <Image source={{ uri: item.image_url }} style={s.searchImg} resizeMode="contain" />
                  : <View style={s.searchImgPlaceholder}><Text style={{ fontSize: 20 }}>📦</Text></View>
                }
                <View style={s.searchInfo}>
                  <Text style={s.searchCat}>{item.categoryName}</Text>
                  <Text style={s.searchName} numberOfLines={2}>{item.name}</Text>
                  {item.price !== null
                    ? <Text style={s.searchPrice}>{item.price.toLocaleString('ru-RU')} ₽ / {item.unit}</Text>
                    : <Text style={s.searchNoPrice}>Цену уточняйте</Text>
                  }
                </View>
                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={() => (
            <View>
              <BannerCarousel onSlugPress={(slug) => slug && router.push(`/catalog/${slug}` as any)} />
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
      )}
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  banner: { paddingHorizontal: 24, paddingVertical: 28, overflow: 'hidden', position: 'relative', minHeight: 180, justifyContent: 'flex-end' },
  bannerBadge: { backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  bannerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bannerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', lineHeight: 32, marginBottom: 6 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 18, marginBottom: 14 },
  bannerCta: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  bannerCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bannerCircle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -60, right: -40, opacity: 0.25 },
  bannerCircle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, top: 40, right: 60, opacity: 0.15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: '#f1f5f9' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1' },
  dotActive: { width: 20, backgroundColor: '#1a56db' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },


  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#0f172a' },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle2: { fontSize: 16, fontWeight: '700', color: '#0f172a', paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  quickRow: { paddingHorizontal: 16, gap: 10 },
  quickCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', width: 80, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  quickIcon: { fontSize: 26, marginBottom: 6 },
  quickName: { fontSize: 11, fontWeight: '600', color: '#475569', textAlign: 'center' },

  searchHeader: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 2 },
  cancelText: { fontSize: 15, color: PRIMARY, fontWeight: '500' },
  searchCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#f1f5f9' },
  searchImgPlaceholder: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  searchInfo: { flex: 1 },
  searchCat: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  searchName: { fontSize: 13, fontWeight: '500', color: '#0f172a', lineHeight: 18, marginBottom: 4 },
  searchPrice: { fontSize: 15, fontWeight: '700', color: PRIMARY },
  searchNoPrice: { fontSize: 13, color: '#94a3b8' },
  emptyText: { fontSize: 15, color: '#94a3b8' },
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
