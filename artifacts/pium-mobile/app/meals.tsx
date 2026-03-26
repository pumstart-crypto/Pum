import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import C from '@/constants/colors';

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface MealMenu {
  type: string;
  menu: string[];
  calorie?: number;
  price?: number;
  operatingHours?: string;
}

interface CafeteriaData {
  name: string;
  location?: string;
  meals: MealMenu[];
}

interface MealData {
  date: string;
  cafeterias: CafeteriaData[];
}

const MEAL_COLORS: Record<string, string> = {
  '조식': '#F59E0B',
  '중식': '#3B82F6',
  '석식': '#8B5CF6',
  '조중식': '#10B981',
};

const MEAL_ICONS: Record<string, string> = {
  '조식': 'sun',
  '중식': 'clock',
  '석식': 'moon',
  '조중식': 'coffee',
};

export default function MealsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const [meals, setMeals] = useState<MealData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(0);

  const getDates = () => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i - 1);
      return d;
    });
  };
  const dates = getDates();

  const fetchMeals = useCallback(async () => {
    try {
      const r = await fetch(`${API}/meals`);
      if (r.ok) setMeals(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMeals(); }, [fetchMeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  }, [fetchMeals]);

  const currentMeals = meals[selectedDate] || null;

  const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>학식 메뉴</Text>
        <TouchableOpacity onPress={() => router.push('/restaurant' as any)} style={styles.restaurantBtn}>
          <Text style={styles.restaurantBtnText}>외식</Text>
        </TouchableOpacity>
      </View>

      {/* Date selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll} contentContainerStyle={styles.dateContainer}>
        {dates.map((d, i) => {
          const isToday = i === 1;
          const isSelected = i === selectedDate;
          return (
            <TouchableOpacity key={i} style={[styles.dateChip, isSelected && styles.dateChipSelected]} onPress={() => setSelectedDate(i)}>
              <Text style={[styles.dateChipDay, isSelected && styles.dateChipDaySelected, isToday && !isSelected && { color: C.primary }]}>
                {isToday ? '오늘' : DAY_NAMES[d.getDay()]}
              </Text>
              <Text style={[styles.dateChipDate, isSelected && styles.dateChipDateSelected]}>
                {d.getMonth() + 1}/{d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: isWeb ? 50 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
        ) : !currentMeals || !currentMeals.cafeterias.length ? (
          <View style={styles.empty}>
            <Feather name="coffee" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>식단 정보 없음</Text>
            <Text style={styles.emptyDesc}>해당 날짜의 식단 정보가 없습니다</Text>
          </View>
        ) : (
          currentMeals.cafeterias.map((cafeteria, cIdx) => (
            <View key={cIdx} style={styles.cafeteriaCard}>
              <View style={styles.cafeteriaHeader}>
                <Text style={styles.cafeteriaName}>{cafeteria.name}</Text>
                {cafeteria.location && (
                  <View style={styles.locationBadge}>
                    <Feather name="map-pin" size={11} color="#6B7280" />
                    <Text style={styles.locationText}>{cafeteria.location}</Text>
                  </View>
                )}
              </View>
              {cafeteria.meals.map((meal, mIdx) => {
                const color = MEAL_COLORS[meal.type] || '#6B7280';
                const icon = MEAL_ICONS[meal.type] || 'utensils';
                return (
                  <View key={mIdx} style={styles.mealSection}>
                    <View style={[styles.mealTypeBar, { backgroundColor: color + '18' }]}>
                      <Feather name={icon as any} size={14} color={color} />
                      <Text style={[styles.mealType, { color }]}>{meal.type}</Text>
                      {meal.operatingHours && (
                        <Text style={styles.mealHours}>{meal.operatingHours}</Text>
                      )}
                      <View style={{ flex: 1 }} />
                      {meal.price ? <Text style={styles.mealPrice}>{meal.price.toLocaleString()}원</Text> : null}
                      {meal.calorie ? <Text style={styles.mealCal}>{meal.calorie}kcal</Text> : null}
                    </View>
                    {meal.menu.map((item, iIdx) => (
                      <Text key={iIdx} style={styles.menuItem}>• {item}</Text>
                    ))}
                  </View>
                );
              })}
            </View>
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
  restaurantBtn: { backgroundColor: '#EEF4FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  restaurantBtnText: { fontSize: 13, color: C.primary, fontFamily: 'Inter_600SemiBold' },
  dateScroll: { backgroundColor: '#fff' },
  dateContainer: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  dateChip: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, backgroundColor: '#F3F4F6', minWidth: 52 },
  dateChipSelected: { backgroundColor: C.primary },
  dateChipDay: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#6B7280' },
  dateChipDaySelected: { color: '#fff' },
  dateChipDate: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#111827', marginTop: 2 },
  dateChipDateSelected: { color: '#fff' },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#374151' },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  cafeteriaCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cafeteriaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cafeteriaName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  locationText: { fontSize: 11, color: '#6B7280', fontFamily: 'Inter_400Regular' },
  mealSection: { marginBottom: 10 },
  mealTypeBar: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 6 },
  mealType: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  mealHours: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular' },
  mealPrice: { fontSize: 12, color: '#374151', fontFamily: 'Inter_600SemiBold' },
  mealCal: { fontSize: 11, color: '#9CA3AF', fontFamily: 'Inter_400Regular', marginLeft: 4 },
  menuItem: { fontSize: 14, color: '#374151', fontFamily: 'Inter_400Regular', lineHeight: 22, paddingLeft: 4 },
});
