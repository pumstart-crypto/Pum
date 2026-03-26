import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
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

interface StopInfo {
  idx: number;
  name: string;
  arsno: string;
  isEndPoint: boolean;
}

interface BusOnRoute {
  idx: number;
  stopName: string;
  carNo: string;
  lowFloor: boolean;
}

interface RouteData {
  lineId: string;
  lineName: string;
  stops: StopInfo[];
  buses: BusOnRoute[];
  fetchedAt: string;
  outboundCount: number;
  inboundCount: number;
}

export default function BusScreen() {
  const apiUrl = useApiUrl();
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBus = async () => {
    try {
      setError("");
      const res = await fetch(`${apiUrl}/bus/route`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.message || "버스 정보를 불러올 수 없습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchBus();
    intervalRef.current = setInterval(fetchBus, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBus();
  };

  const getBusAtStop = (stopIdx: number) =>
    data?.buses.filter((b) => b.idx === stopIdx) || [];

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Feather name="alert-circle" size={48} color={C.textTertiary} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={fetchBus}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Info Bar */}
      {data && (
        <View style={styles.infoBar}>
          <View>
            <Text style={styles.routeName}>{data.lineName}</Text>
            <Text style={styles.fetchedAt}>
              {data.fetchedAt ? `${new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준` : ""}
            </Text>
          </View>
          <View style={styles.busCountRow}>
            <View style={styles.busCountItem}>
              <Text style={styles.busCountNum}>{data.outboundCount}</Text>
              <Text style={styles.busCountLabel}>출발</Text>
            </View>
            <View style={styles.busCountItem}>
              <Text style={styles.busCountNum}>{data.inboundCount}</Text>
              <Text style={styles.busCountLabel}>복귀</Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={data?.stops || []}
        keyExtractor={(item) => String(item.idx)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        renderItem={({ item, index }) => {
          const buses = getBusAtStop(item.idx);
          const hasBus = buses.length > 0;
          return (
            <View style={[styles.stopRow, item.isEndPoint && styles.stopRowEnd]}>
              <View style={styles.lineSection}>
                {index !== 0 && <View style={styles.lineTop} />}
                <View style={[styles.dot, hasBus ? styles.dotBus : item.isEndPoint ? styles.dotEnd : {}]} />
                {index !== (data?.stops.length || 0) - 1 && <View style={styles.lineBot} />}
              </View>
              <View style={styles.stopInfo}>
                <View style={styles.stopNameRow}>
                  <Text style={[styles.stopName, hasBus && { color: C.primary, fontFamily: "Inter_700Bold" }]}>
                    {item.name}
                  </Text>
                  {item.arsno && (
                    <Text style={styles.arsno}>{item.arsno}</Text>
                  )}
                </View>
                {buses.map((b) => (
                  <View key={b.carNo} style={styles.busBadge}>
                    <Feather name="navigation" size={12} color="#fff" />
                    <Text style={styles.busCarNo}>{b.carNo}</Text>
                    {b.lowFloor && (
                      <View style={styles.lowFloorBadge}>
                        <Text style={styles.lowFloorText}>저상</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  infoBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.primary,
    padding: 16,
  },
  routeName: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff" },
  fetchedAt: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  busCountRow: { flexDirection: "row", gap: 16 },
  busCountItem: { alignItems: "center" },
  busCountNum: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  busCountLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)" },
  stopRow: {
    flexDirection: "row",
    minHeight: 52,
  },
  stopRowEnd: {},
  lineSection: {
    width: 32,
    alignItems: "center",
  },
  lineTop: { width: 2, flex: 1, backgroundColor: C.border },
  lineBot: { width: 2, flex: 1, backgroundColor: C.border },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.border, marginVertical: 2 },
  dotBus: { backgroundColor: C.primary, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#fff", shadowColor: C.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  dotEnd: { backgroundColor: "#111827" },
  stopInfo: { flex: 1, paddingLeft: 8, paddingVertical: 8 },
  stopNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopName: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  arsno: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  busBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.primary,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  busCarNo: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  lowFloorBadge: { backgroundColor: "rgba(255,255,255,0.3)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  lowFloorText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#fff" },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 16, color: C.textSecondary, textAlign: "center", marginVertical: 16 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
