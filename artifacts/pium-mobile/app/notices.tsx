import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useApiUrl } from "@/contexts/AuthContext";

const C = Colors.light;

interface Notice {
  id: string;
  title: string;
  date: string;
  writer: string;
  views: number;
  isPinned: boolean;
  url: string;
}

const FILTERS = ["전체", "중요", "일반"];

export default function NoticesScreen() {
  const apiUrl = useApiUrl();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("전체");

  const fetchNotices = async () => {
    try {
      const res = await fetch(`${apiUrl}/notices`);
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || data || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchNotices(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotices();
  };

  const filtered = notices.filter((n) => {
    if (filter === "중요") return n.isPinned;
    if (filter === "일반") return !n.isPinned;
    return true;
  });

  const renderItem = ({ item }: { item: Notice }) => (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
      onPress={() => item.url && Linking.openURL(item.url)}
    >
      {item.isPinned && (
        <View style={styles.pinnedRow}>
          <Feather name="pin" size={12} color={C.primary} />
          <Text style={styles.pinnedText}>공지</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{item.writer}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{item.date}</Text>
        <View style={styles.viewsRow}>
          <Feather name="eye" size={12} color={C.textTertiary} />
          <Text style={styles.metaText}>{item.views.toLocaleString()}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Filter */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && { backgroundColor: C.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && { color: "#fff" }]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="bell-off" size={40} color={C.textTertiary} />
              <Text style={styles.emptyText}>공지사항을 불러올 수 없습니다</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  pinnedText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.primary },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, lineHeight: 22, marginBottom: 8 },
  meta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  metaDot: { color: C.textTertiary, fontSize: 12 },
  viewsRow: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 4 },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
});
