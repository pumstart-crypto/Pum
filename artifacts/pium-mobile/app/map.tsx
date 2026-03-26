import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";

const C = Colors.light;

// react-native-maps is not installed; using building list with coordinates display
const BUILDINGS = [
  { id: 1, name: "제1공학관", lat: 35.2327, lng: 129.0843, category: "학관", desc: "공대 강의실" },
  { id: 2, name: "제2공학관", lat: 35.2334, lng: 129.0855, category: "학관", desc: "공대 실습실" },
  { id: 3, name: "금정회관", lat: 35.2310, lng: 129.0830, category: "편의시설", desc: "학생식당, 매점" },
  { id: 4, name: "학생회관", lat: 35.2320, lng: 129.0820, category: "편의시설", desc: "동아리방, 식당" },
  { id: 5, name: "도서관", lat: 35.2315, lng: 129.0838, category: "학습공간", desc: "중앙도서관" },
  { id: 6, name: "효원문화회관", lat: 35.2302, lng: 129.0845, category: "문화", desc: "공연장, 전시실" },
  { id: 7, name: "사범관", lat: 35.2341, lng: 129.0862, category: "학관", desc: "사범대 강의실" },
  { id: 8, name: "인문관", lat: 35.2328, lng: 129.0828, category: "학관", desc: "인문대 강의실" },
  { id: 9, name: "경영관", lat: 35.2305, lng: 129.0851, category: "학관", desc: "경영대 강의실" },
  { id: 10, name: "의과대학", lat: 35.2349, lng: 129.0876, category: "학관", desc: "의대 강의실" },
  { id: 11, name: "정보의생명공학관", lat: 35.2338, lng: 129.0869, category: "학관", desc: "IT관련 학과" },
  { id: 12, name: "웅비관", lat: 35.2298, lng: 129.0833, category: "기숙사", desc: "기숙사" },
];

const CATEGORIES = ["전체", "학관", "편의시설", "학습공간", "문화", "기숙사"];

const CAT_COLORS: Record<string, string> = {
  학관: "#3B82F6",
  편의시설: "#10B981",
  학습공간: "#F59E0B",
  문화: "#8B5CF6",
  기숙사: "#EC4899",
  전체: C.textSecondary,
};

const CAT_ICONS: Record<string, string> = {
  학관: "book",
  편의시설: "coffee",
  학습공간: "bookmark",
  문화: "music",
  기숙사: "home",
};

export default function MapScreen() {
  const [selectedCat, setSelectedCat] = useState("전체");
  const [selectedBuilding, setSelectedBuilding] = useState<typeof BUILDINGS[0] | null>(null);

  const filtered = BUILDINGS.filter((b) =>
    selectedCat === "전체" || b.category === selectedCat
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catList}
      >
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.catChip, selectedCat === c && { backgroundColor: CAT_COLORS[c] || C.primary }]}
            onPress={() => setSelectedCat(c)}
          >
            {c !== "전체" && selectedCat === c && (
              <Feather name={(CAT_ICONS[c] as any) || "map-pin"} size={14} color="#fff" />
            )}
            <Text style={[styles.catText, selectedCat === c && { color: "#fff" }]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Map placeholder and building list */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapBg}>
          <Feather name="map" size={48} color={C.primary} />
          <Text style={styles.mapText}>부산대학교 캠퍼스</Text>
          <Text style={styles.mapSubText}>아래 목록에서 건물을 선택하세요</Text>
        </View>
      </View>

      {/* Building List */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>{selectedCat === "전체" ? "전체 건물" : selectedCat} ({filtered.length})</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {filtered.map((b) => {
            const color = CAT_COLORS[b.category] || C.primary;
            const isSelected = selectedBuilding?.id === b.id;
            return (
              <Pressable
                key={b.id}
                style={[styles.buildingCard, isSelected && { borderColor: color, borderWidth: 2 }]}
                onPress={() => setSelectedBuilding(isSelected ? null : b)}
              >
                <View style={[styles.buildingIcon, { backgroundColor: color + "20" }]}>
                  <Feather name={(CAT_ICONS[b.category] as any) || "map-pin"} size={20} color={color} />
                </View>
                <View style={styles.buildingInfo}>
                  <Text style={styles.buildingName}>{b.name}</Text>
                  <Text style={styles.buildingDesc}>{b.desc}</Text>
                </View>
                <View style={[styles.catTag, { backgroundColor: color + "20" }]}>
                  <Text style={[styles.catTagText, { color }]}>{b.category}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  catScroll: { maxHeight: 48, marginTop: 8 },
  catList: { paddingHorizontal: 16, gap: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  catText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  mapPlaceholder: {
    height: 180,
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.primaryLight,
  },
  mapBg: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  mapText: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.primary },
  mapSubText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  listSection: { flex: 1, paddingHorizontal: 16 },
  listTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text, marginBottom: 10 },
  buildingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  buildingIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  buildingInfo: { flex: 1 },
  buildingName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  buildingDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  catTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catTagText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});
