import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApiUrl } from "@/contexts/AuthContext";

const C = Colors.light;

const EXPENSE_CATS = ["식비", "교통", "쇼핑", "여가", "의료", "교육", "기타"];
const INCOME_CATS = ["용돈", "알바", "장학금", "기타"];

interface Finance {
  id: number;
  type: "income" | "expense";
  amount: number;
  category: string;
  description?: string;
  date: string;
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

const CAT_ICONS: Record<string, string> = {
  식비: "coffee",
  교통: "navigation",
  쇼핑: "shopping-bag",
  여가: "music",
  의료: "activity",
  교육: "book",
  용돈: "gift",
  알바: "briefcase",
  장학금: "award",
  기타: "more-horizontal",
};

const CAT_COLORS: Record<string, string> = {
  식비: "#F97316", 교통: "#3B82F6", 쇼핑: "#EC4899",
  여가: "#8B5CF6", 의료: "#EF4444", 교육: "#10B981",
  용돈: "#F59E0B", 알바: "#6366F1", 장학금: "#14B8A6", 기타: "#9CA3AF",
};

function formatMoney(n: number) {
  return `${n.toLocaleString()}원`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BudgetScreen() {
  const apiUrl = useApiUrl();
  const [records, setRecords] = useState<Finance[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tabType, setTabType] = useState<"expense" | "income">("expense");
  const [form, setForm] = useState({
    type: "expense" as "expense" | "income",
    amount: "",
    category: "식비",
    description: "",
    date: todayStr(),
  });

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const fetchData = async () => {
    try {
      const [recRes, sumRes] = await Promise.all([
        fetch(`${apiUrl}/finance?month=${monthKey}`),
        fetch(`${apiUrl}/finance/summary?month=${monthKey}`),
      ]);
      if (recRes.ok) setRecords(await recRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = (type: "expense" | "income") => {
    setForm({
      type,
      amount: "",
      category: type === "expense" ? "식비" : "용돈",
      description: "",
      date: todayStr(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.amount) return;
    try {
      const res = await fetch(`${apiUrl}/finance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          amount: parseFloat(form.amount),
          category: form.category,
          description: form.description || null,
          date: form.date,
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchData();
        setShowModal(false);
      }
    } catch {}
  };

  const handleDelete = (id: number) => {
    Alert.alert("삭제", "이 항목을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          await fetch(`${apiUrl}/finance/${id}`, { method: "DELETE" });
          fetchData();
        },
      },
    ]);
  };

  const filtered = records.filter((r) =>
    tabType === "expense" ? r.type === "expense" : r.type === "income"
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <>
          {/* Summary */}
          <View style={styles.summarySection}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryMonth}>
                {now.getMonth() + 1}월 가계부
              </Text>
              <Text style={styles.balanceValue}>
                {summary ? formatMoney(Math.abs(summary.balance)) : "—"}
              </Text>
              <Text style={[styles.balanceSub, { color: summary && summary.balance >= 0 ? C.accent : C.danger }]}>
                {summary && summary.balance >= 0 ? "흑자" : "적자"}
              </Text>
              <View style={styles.incExpRow}>
                <View style={styles.incExpItem}>
                  <View style={[styles.dot, { backgroundColor: C.accent }]} />
                  <Text style={styles.incExpLabel}>수입</Text>
                  <Text style={[styles.incExpValue, { color: C.accent }]}>
                    {summary ? formatMoney(summary.totalIncome) : "—"}
                  </Text>
                </View>
                <View style={[styles.divider]} />
                <View style={styles.incExpItem}>
                  <View style={[styles.dot, { backgroundColor: C.danger }]} />
                  <Text style={styles.incExpLabel}>지출</Text>
                  <Text style={[styles.incExpValue, { color: C.danger }]}>
                    {summary ? formatMoney(summary.totalExpense) : "—"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Add Buttons */}
            <View style={styles.addBtns}>
              <Pressable style={[styles.addBtn, { backgroundColor: C.danger }]} onPress={() => openAdd("expense")}>
                <Feather name="minus" size={20} color="#fff" />
                <Text style={styles.addBtnText}>지출</Text>
              </Pressable>
              <Pressable style={[styles.addBtn, { backgroundColor: C.accent }]} onPress={() => openAdd("income")}>
                <Feather name="plus" size={20} color="#fff" />
                <Text style={styles.addBtnText}>수입</Text>
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, tabType === "expense" && styles.tabActive]}
              onPress={() => setTabType("expense")}
            >
              <Text style={[styles.tabText, tabType === "expense" && styles.tabTextActive]}>
                지출
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tabType === "income" && styles.tabActive]}
              onPress={() => setTabType("income")}
            >
              <Text style={[styles.tabText, tabType === "income" && styles.tabTextActive]}>
                수입
              </Text>
            </Pressable>
          </View>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Feather name="inbox" size={40} color={C.textTertiary} />
                <Text style={styles.emptyText}>내역이 없습니다</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.recordCard} onLongPress={() => handleDelete(item.id)}>
                <View style={[styles.recordIcon, { backgroundColor: (CAT_COLORS[item.category] || C.primary) + "20" }]}>
                  <Feather name={(CAT_ICONS[item.category] as any) || "circle"} size={20} color={CAT_COLORS[item.category] || C.primary} />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordCat}>{item.category}</Text>
                  {item.description && (
                    <Text style={styles.recordDesc}>{item.description}</Text>
                  )}
                  <Text style={styles.recordDate}>{item.date}</Text>
                </View>
                <Text style={[styles.recordAmount, { color: item.type === "income" ? C.accent : C.danger }]}>
                  {item.type === "income" ? "+" : "-"}{formatMoney(item.amount)}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{form.type === "expense" ? "지출 추가" : "수입 추가"}</Text>
            <Pressable onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </Pressable>
          </View>

          <Text style={styles.amtLabel}>금액</Text>
          <View style={styles.amtRow}>
            <TextInput
              style={styles.amtInput}
              value={form.amount}
              onChangeText={(t) => setForm((f) => ({ ...f, amount: t.replace(/[^0-9.]/g, "") }))}
              placeholder="0"
              placeholderTextColor={C.textTertiary}
              keyboardType="numeric"
              autoFocus
            />
            <Text style={styles.won}>원</Text>
          </View>

          <Text style={styles.fieldLabel}>카테고리</Text>
          <View style={styles.catGrid}>
            {(form.type === "expense" ? EXPENSE_CATS : INCOME_CATS).map((c) => (
              <Pressable
                key={c}
                style={[styles.catOption, form.category === c && { backgroundColor: C.primary, borderColor: C.primary }]}
                onPress={() => setForm((f) => ({ ...f, category: c }))}
              >
                <Feather name={(CAT_ICONS[c] as any) || "circle"} size={16} color={form.category === c ? "#fff" : CAT_COLORS[c] || C.textSecondary} />
                <Text style={[styles.catOptionText, form.category === c && { color: "#fff" }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>메모 (선택)</Text>
          <TextInput
            style={styles.descInput}
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            placeholder="메모를 입력하세요"
            placeholderTextColor={C.textTertiary}
          />

          <Pressable style={[styles.saveBtn, { backgroundColor: form.type === "expense" ? C.danger : C.accent }]} onPress={handleSave}>
            <Text style={styles.saveBtnText}>추가</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  summarySection: { padding: 16, gap: 12 },
  summaryCard: { backgroundColor: C.surface, borderRadius: 20, padding: 20, alignItems: "center", gap: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  summaryMonth: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
  balanceValue: { fontFamily: "Inter_700Bold", fontSize: 36, color: C.text },
  balanceSub: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  incExpRow: { flexDirection: "row", gap: 16, marginTop: 12, width: "100%" },
  incExpItem: { flex: 1, alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  incExpLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  incExpValue: { fontFamily: "Inter_700Bold", fontSize: 16 },
  divider: { width: 1, height: "100%", backgroundColor: C.border },
  addBtns: { flexDirection: "row", gap: 12 },
  addBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: C.surfaceSecondary, borderRadius: 10, padding: 3, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: C.surface, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
  tabTextActive: { fontFamily: "Inter_600SemiBold", color: C.text },
  recordCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 12, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  recordIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  recordInfo: { flex: 1 },
  recordCat: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  recordDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  recordDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  recordAmount: { fontFamily: "Inter_700Bold", fontSize: 16 },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
  modal: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 12 },
  modalHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  amtLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary, marginBottom: 4 },
  amtRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 24 },
  amtInput: { fontFamily: "Inter_700Bold", fontSize: 40, color: C.text, flex: 1 },
  won: { fontFamily: "Inter_600SemiBold", fontSize: 24, color: C.textSecondary },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  catGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  catOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border },
  catOptionText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  descInput: { backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 16, color: C.text, marginBottom: 20 },
  saveBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
});
