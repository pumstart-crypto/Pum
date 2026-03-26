import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
  menu?: { name: string; price: number; desc?: string }[];
}

const PRICE_COLORS: Record<string, string> = {
  저렴: '#059669', 보통: '#2563EB', 비쌈: '#DC2626',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Feather key={i} name="star" size={16} color={i <= Math.round(rating) ? '#F59E0B' : '#E5E7EB'} />
      ))}
    </View>
  );
}

export default function RestaurantDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRestaurant = useCallback(async () => {
    try {
      const r = await fetch(`${API}/restaurants/${id}`);
      if (r.ok) setRestaurant(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchRestaurant(); }, [fetchRestaurant]);

  const callPhone = () => {
    if (restaurant?.phone) Linking.openURL(`tel:${restaurant.phone}`);
  };

  const openMap = () => {
    if (restaurant?.address) {
      Linking.openURL(`nmap://search?query=${encodeURIComponent(restaurant.address)}&appname=pium`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>식당 정보</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={[styles.root, { paddingTop: topPad, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 16, color: '#6B7280' }}>정보를 찾을 수 없습니다</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: C.primary, marginTop: 16 }}>돌아가기</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{restaurant.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Feather name="utensils" size={32} color={C.primary} />
          </View>
          <Text style={styles.heroName}>{restaurant.name}</Text>
          <View style={styles.heroMeta}>
            <View style={styles.catBadge}>
              <Text style={styles.catText}>{restaurant.category}</Text>
            </View>
            {restaurant.priceRange && (
              <View style={[styles.priceBadge, { backgroundColor: (PRICE_COLORS[restaurant.priceRange] || '#6B7280') + '18' }]}>
                <Text style={[styles.priceBadgeText, { color: PRICE_COLORS[restaurant.priceRange] || '#6B7280' }]}>{restaurant.priceRange}</Text>
              </View>
            )}
          </View>
          {restaurant.rating !== undefined && (
            <View style={styles.ratingSection}>
              <StarRating rating={restaurant.rating} />
              <Text style={styles.ratingValue}>{restaurant.rating.toFixed(1)}</Text>
              {restaurant.reviewCount !== undefined && <Text style={styles.reviewCount}>({restaurant.reviewCount}개 리뷰)</Text>}
            </View>
          )}
          {restaurant.description && <Text style={styles.description}>{restaurant.description}</Text>}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          {restaurant.address && (
            <TouchableOpacity style={styles.infoRow} onPress={openMap}>
              <View style={styles.infoIcon}><Feather name="map-pin" size={16} color={C.primary} /></View>
              <Text style={styles.infoText} numberOfLines={2}>{restaurant.address}</Text>
              <Feather name="external-link" size={14} color="#D1D5DB" />
            </TouchableOpacity>
          )}
          {restaurant.phone && (
            <TouchableOpacity style={[styles.infoRow, styles.infoRowBorder]} onPress={callPhone}>
              <View style={styles.infoIcon}><Feather name="phone" size={16} color={C.primary} /></View>
              <Text style={styles.infoText}>{restaurant.phone}</Text>
              <Feather name="chevron-right" size={14} color="#D1D5DB" />
            </TouchableOpacity>
          )}
          {restaurant.openingHours && (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <View style={styles.infoIcon}><Feather name="clock" size={16} color={C.primary} /></View>
              <Text style={styles.infoText}>{restaurant.openingHours}</Text>
            </View>
          )}
          {restaurant.distance && (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <View style={styles.infoIcon}><Feather name="navigation" size={16} color={C.primary} /></View>
              <Text style={styles.infoText}>캠퍼스에서 {restaurant.distance}</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {restaurant.tags && restaurant.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>태그</Text>
            <View style={styles.tagsWrap}>
              {restaurant.tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Menu */}
        {restaurant.menu && restaurant.menu.length > 0 && (
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>메뉴</Text>
            <View style={styles.menuCard}>
              {restaurant.menu.map((item, i) => (
                <View key={i} style={[styles.menuRow, i < restaurant.menu!.length - 1 && styles.menuRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    {item.desc && <Text style={styles.menuDesc}>{item.desc}</Text>}
                  </View>
                  <Text style={styles.menuPrice}>{item.price.toLocaleString()}원</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {restaurant.phone && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={callPhone}>
              <Feather name="phone" size={18} color={C.primary} />
              <Text style={styles.actionBtnOutlineText}>전화</Text>
            </TouchableOpacity>
          )}
          {restaurant.address && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={openMap}>
              <Feather name="map-pin" size={18} color="#fff" />
              <Text style={styles.actionBtnPrimaryText}>길찾기</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  heroCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  heroIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  heroName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#111827' },
  heroMeta: { flexDirection: 'row', gap: 8 },
  catBadge: { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  catText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: C.primary },
  priceBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  priceBadgeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  ratingSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#F59E0B' },
  reviewCount: { fontSize: 13, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  description: { fontSize: 14, color: '#6B7280', fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  infoText: { flex: 1, fontSize: 14, color: '#374151', fontFamily: 'Inter_400Regular' },
  tagsSection: { gap: 10 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#374151' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 13, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  menuSection: { gap: 10 },
  menuCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#111827' },
  menuDesc: { fontSize: 12, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginTop: 2 },
  menuPrice: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14 },
  actionBtnOutline: { borderWidth: 1.5, borderColor: C.primary },
  actionBtnOutlineText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primary },
  actionBtnPrimary: { backgroundColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  actionBtnPrimaryText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
