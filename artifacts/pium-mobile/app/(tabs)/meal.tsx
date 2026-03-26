import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApiUrl } from "@/contexts/AuthContext";

const C = Colors.light;

const RESTAURANTS = [
  { code: "PG002", name: "금정회관 학생식당" },
  { code: "PH002", name: "학생회관 식당" },
  { code: "PG001", name: "금정회관 교직원식당" },
];

interface SubMenu {
  name: string;
  price: string;
  items: string[];
}

interface MealRow {
  type: string;
  hours: string;
  days: Array<{
    date: string;
    day: string;
    subMenus: SubMenu[];
  }>;
}

interface WeekMeals {
  restaurantName: string;
  dates: string[];
  days: string[];
  mealRows: MealRow[];
}

const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export default function MealScreen() {
  const insets = useSafeAreaInsets();
  const apiUrl = useApiUrl();
  const [selectedRestaurant, setSelectedRestaurant] = useState(RESTAURANTS[0].code);
  const [data, setData] = useState<WeekMeals | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);

  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : 100;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const fetchMeals = async () => {
    try {
      const res = await fetch(`${apiUrl}/meals?restaurant=${selectedRestaurant}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        const idx = (json.dates as string[]).findIndex((d: string) => d === todayStr);
        if (idx >= 0) setSelectedDayIdx(idx);
        else setSelectedDayIdx(0);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchMeals();
  }, [selectedRestaurant]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMeals();
    setRefreshing(false);
  };

  const selectedDate = data?.dates[selectedDayIdx];
  const selectedDay = data?.days[selectedDayIdx];

  const getMealRowsForDay = () => {
    if (!data) return [];
    return data.mealRows
      .map((row) => ({
        type: row.type,
        hours: row.hours,
        subMenus: row.days[selectedDayIdx]?.subMenus || [],
      }))
      .filter((r) => r.subMenus.length > 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={styles.headerTitle}>학식</Text>
      </View>

      {/* Restaurant Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.restaurantScroll}
        contentContainerStyle={styles.restaurantList}
      >
        {RESTAURANTS.map((r) => (
          <Pressable
            key={r.code}
            style={[
              styles.restaurantChip,
              selectedRestaurant === r.code && { backgroundColor: C.primary },
            ]}
            onPress={() => setSelectedRestaurant(r.code)}
          >
            <Text
              style={[
                styles.restaurantChipText,
                selectedRestaurant === r.code && { color: "#fff" },
              ]}
            >
              {r.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={C.textTertiary} />
          <Text style={styles.emptyText}>식단 정보를 불러올 수 없습니다</Text>
        </View>
      ) : (
        <>
          {/* Day Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayScroll}
            contentContainerStyle={styles.dayList}
          >
            {data.dates.map((d, i) => {
              const isToday = d === todayStr;
              const isSelected = i === selectedDayIdx;
              const date = new Date(d);
              return (
                <Pressable
                  key={d}
                  style={[styles.dayChip, isSelected && { backgroundColor: C.primary }]}
                  onPress={() => setSelectedDayIdx(i)}
                >
                  <Text style={[styles.dayName, isSelected && { color: "#fff" }]}>
                    {data.days[i]}
                  </Text>
                  <Text style={[styles.dayDate, isSelected && { color: "rgba(255,255,255,0.8)" }]}>
                    {date.getDate()}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayDot, isSelected && { backgroundColor: "#fff" }]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding, paddingTop: 8 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
            }
          >
            {getMealRowsForDay().length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="moon" size={32} color={C.textTertiary} />
                <Text style={styles.emptyText}>오늘은 식단 정보가 없습니다</Text>
              </View>
            ) : (
              getMealRowsForDay().map((row, i) => (
                <View key={i} style={styles.mealSection}>
                  <View style={styles.mealTypeHeader}>
                    <Text style={styles.mealType}>{row.type}</Text>
                    {row.hours && (
                      <Text style={styles.mealHours}>{row.hours}</Text>
                    )}
                  </View>
                  {row.subMenus.map((menu, mi) => (
                    <View key={mi} style={styles.menuCard}>
                      <View style={styles.menuTitleRow}>
                        <Text style={styles.menuName}>{menu.name}</Text>
                        {menu.price && (
                          <Text style={styles.menuPrice}>{menu.price}</Text>
                        )}
                      </View>
                      {menu.items.map((item, ii) => (
                        <Text key={ii} style={styles.menuItem}>· {item}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.background,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  restaurantScroll: {
    maxHeight: 48,
  },
  restaurantList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  restaurantChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  restaurantChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textSecondary,
  },
  dayScroll: {
    maxHeight: 72,
    marginTop: 8,
  },
  dayList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayChip: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: C.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    gap: 2,
    position: "relative",
  },
  dayName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: C.textSecondary,
  },
  dayDate: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
  },
  todayDot: {
    position: "absolute",
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textTertiary,
  },
  mealSection: {
    marginBottom: 20,
  },
  mealTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  mealType: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
  },
  mealHours: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
  menuCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  menuName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.text,
    flex: 1,
  },
  menuPrice: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.primary,
  },
  menuItem: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 22,
  },
});
