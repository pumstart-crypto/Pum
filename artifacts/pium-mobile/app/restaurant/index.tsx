import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface Restaurant {
  id: number;
  name: string;
  category: string;
  description?: string;
  address?: string;
  phone?: string;
  openingHours?: string;
  priceRange?: string;
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  distance?: string;
}

const PRICE_RANGE = ['전체', '저렴', '보통', '비쌈'];
const CATEGORIES = ['전체', '한식', '중식', '일식', '양식', '분식', '카페', '패스트푸드', '기타'];

const PRICE_COLORS: Record<string, string> = {
  저렴: '#059669', 보통: '#2563EB', 비쌈: '#DC2626',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Feather key={i} name={i <= Math.round(rating) ? 'star' : 'star'} size={12} color={i <= Math.round(rating) ? '#F59E0B' : '#E5E7EB'} />
      ))}
    </View>
  );
}

export default function RestaurantListScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('전체');
  const [priceFilter, setPriceFilter] = useState('전체');

  const fetchRestaurants = useCallback(async () => {
    try {
      const r = await fetch(`${API}/restaurants`);
      if (r.ok) setRestaurants(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRestaurants();
    setRefreshing(false);
  }, [fetchRestaurants]);

  const filtered = restaurants.filter(r =>
    (category === '전체' || r.category === category) &&
    (priceFilter === '전체' || r.priceRange === priceFilter) &&
    (!search || r.name.includes(search) || r.category.includes(search))
  );

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>주변 식당</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="식당 검색" placeholderTextColor="#9CA3AF" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color="#9CA3AF" /></TouchableOpacity>}
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity key={cat} style={[styles.filterChip, category === cat && styles.filterChipActive]} onPress={() => setCategory(cat)}>
            <Text style={[styles.filterText, category === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Price range filter */}
        <View style={styles.priceRow}>
          {PRICE_RANGE.map(p => (
            <TouchableOpacity key={p} style={[styles.priceChip, priceFilter === p && styles.priceChipActive]} onPress={() => setPriceFilter(p)}>
              <Text style={[styles.priceChipText, priceFilter === p && styles.priceChipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.resultCount}>{filtered.length}개</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="coffee" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>식당이 없습니다</Text>
          </View>
        ) : (
          filtered.map(r => (
            <TouchableOpacity key={r.id} style={styles.restaurantCard} onPress={() => router.push(`/restaurant/${r.id}` as any)} activeOpacity={0.8}>
              <View style={styles.restaurantLeft}>
                <View style={styles.restaurantIcon}>
                  <Feather name="utensils" size={20} color={C.primary} />
                </View>
              </View>
              <View style={styles.restaurantInfo}>
                <View style={styles.restaurantTop}>
                  <Text style={styles.restaurantName}>{r.name}</Text>
                  {r.priceRange && (
                    <View style={[styles.priceBadge, { backgroundColor: (PRICE_COLORS[r.priceRange] || '#6B7280') + '18' }]}>
                      <Text style={[styles.priceBadgeText, { color: PRICE_COLORS[r.priceRange] || '#6B7280' }]}>{r.priceRange}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.restaurantMeta}>
                  <Text style={styles.restaurantCat}>{r.category}</Text>
                  {r.distance && (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Feather name="map-pin" size={11} color="#9CA3AF" />
                      <Text style={styles.restaurantDist}>{r.distance}</Text>
                    </>
                  )}
                </View>
                {r.rating !== undefined && (
                  <View style={styles.ratingRow}>
                    <StarRating rating={r.rating} />
                    <Text style={styles.ratingText}>{r.rating.toFixed(1)}</Text>
                    {r.reviewCount !== undefined && <Text style={styles.reviewCount}>({r.reviewCount})</Text>}
                  </View>
                )}
                {r.openingHours && <Text style={styles.openingHours}>{r.openingHours}</Text>}
              </View>
              <Feather name="chevron-right" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', fontFamily: 'Inter_400Regular' },
  filterScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  filterChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  filterText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  filterTextActive: { color: C.primary },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  priceChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  priceChipActive: { backgroundColor: '#EEF4FF', borderColor: C.primary },
  priceChipText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  priceChipTextActive: { color: C.primary },
  resultCount: { flex: 1, textAlign: 'right', fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  restaurantCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  restaurantLeft: { alignItems: 'center' },
  restaurantIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  restaurantInfo: { flex: 1, gap: 4 },
  restaurantTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restaurantName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827', flex: 1 },
  priceBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  priceBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  restaurantMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restaurantCat: { fontSize: 12, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  metaDot: { color: '#D1D5DB', fontSize: 12 },
  restaurantDist: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#F59E0B' },
  reviewCount: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  openingHours: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
});
