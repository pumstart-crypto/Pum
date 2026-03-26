import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApiUrl } from "@/contexts/AuthContext";

const C = Colors.light;

const GRADE_POINTS: Record<string, number> = {
  "A+": 4.5, "A0": 4.0, "B+": 3.5, "B0": 3.0,
  "C+": 2.5, "C0": 2.0, "D+": 1.5, "D0": 1.0, "F": 0,
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "#10B981", "A0": "#34D399",
  "B+": "#3B82F6", "B0": "#60A5FA",
  "C+": "#F59E0B", "C0": "#FBBF24",
  "D+": "#EF4444", "D0": "#F87171",
  "F": "#9CA3AF",
};

interface Grade {
  id: number;
  subjectName: string;
  credits: number;
  grade: string;
  year: number;
  semester: string;
  category?: string;
}

function calcGpa(grades: Grade[]) {
  const total = grades.reduce((sum, g) => sum + g.credits, 0);
  if (total === 0) return 0;
  const weighted = grades.reduce(
    (sum, g) => sum + (GRADE_POINTS[g.grade] ?? 0) * g.credits,
    0
  );
  return weighted / total;
}

export default function GradesScreen() {
  const insets = useSafeAreaInsets();
  const apiUrl = useApiUrl();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState({
    subjectName: "",
    credits: "3",
    grade: "A+",
    year: String(new Date().getFullYear()),
    semester: "1학기",
    category: "전공",
  });

  const fetchGrades = async () => {
    try {
      const res = await fetch(`${apiUrl}/grades`);
      if (res.ok) setGrades(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchGrades(); }, []);

  const grouped = grades.reduce<Record<string, Grade[]>>((acc, g) => {
    const key = `${g.year}-${g.semester}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  const gpa = calcGpa(grades);
  const totalCredits = grades.reduce((s, g) => s + g.credits, 0);

  const openAdd = () => {
    setEditing(null);
    setForm({ subjectName: "", credits: "3", grade: "A+", year: String(new Date().getFullYear()), semester: "1학기", category: "전공" });
    setShowModal(true);
  };

  const openEdit = (g: Grade) => {
    setEditing(g);
    setForm({
      subjectName: g.subjectName,
      credits: String(g.credits),
      grade: g.grade,
      year: String(g.year),
      semester: g.semester,
      category: g.category || "전공",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.subjectName.trim()) return;
    const body = {
      subjectName: form.subjectName,
      credits: parseFloat(form.credits),
      grade: form.grade,
      year: parseInt(form.year),
      semester: form.semester,
      category: form.category,
    };
    try {
      if (editing) {
        const res = await fetch(`${apiUrl}/grades/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setGrades((prev) => prev.map((g) => (g.id === editing.id ? updated : g)));
        }
      } else {
        const res = await fetch(`${apiUrl}/grades`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          setGrades((prev) => [...prev, created]);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setShowModal(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert("삭제", "이 성적을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          await fetch(`${apiUrl}/grades/${id}`, { method: "DELETE" });
          setGrades((prev) => prev.filter((g) => g.id !== id));
          setShowModal(false);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* GPA Summary */}
          <View style={[styles.gpaCard, { backgroundColor: C.primary }]}>
            <Text style={styles.gpaLabel}>전체 평점</Text>
            <Text style={styles.gpaValue}>{gpa.toFixed(2)}</Text>
            <Text style={styles.gpaSub}>/ 4.5 · 총 {totalCredits}학점</Text>
          </View>

          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([key, items]) => {
              const semGpa = calcGpa(items);
              const [year, semester] = key.split("-");
              return (
                <View key={key} style={styles.semSection}>
                  <View style={styles.semHeader}>
                    <Text style={styles.semTitle}>{year}년 {semester}</Text>
                    <Text style={styles.semGpa}>평점 {semGpa.toFixed(2)}</Text>
                  </View>
                  {items.map((g) => (
                    <Pressable key={g.id} style={styles.gradeCard} onPress={() => openEdit(g)}>
                      <View style={[styles.gradeBar, { backgroundColor: GRADE_COLORS[g.grade] || C.primary }]} />
                      <View style={styles.gradeInfo}>
                        <Text style={styles.gradeName}>{g.subjectName}</Text>
                        <Text style={styles.gradeMeta}>{g.credits}학점 · {g.category}</Text>
                      </View>
                      <Text style={[styles.gradeValue, { color: GRADE_COLORS[g.grade] || C.text }]}>
                        {g.grade}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}

          {grades.length === 0 && (
            <View style={styles.emptyBox}>
              <Feather name="award" size={48} color={C.textTertiary} />
              <Text style={styles.emptyText}>성적을 추가해보세요</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable style={[styles.fab, { backgroundColor: C.primary }]} onPress={openAdd}>
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      {/* Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? "성적 수정" : "성적 추가"}</Text>
            <Pressable onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <GInput label="과목명" value={form.subjectName} onChangeText={(t) => setForm((f) => ({ ...f, subjectName: t }))} placeholder="과목명" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <GInput label="학점" value={form.credits} onChangeText={(t) => setForm((f) => ({ ...f, credits: t }))} placeholder="3" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <GInput label="연도" value={form.year} onChangeText={(t) => setForm((f) => ({ ...f, year: t }))} placeholder="2025" keyboardType="number-pad" />
              </View>
            </View>

            {/* Semester Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>학기</Text>
              <View style={styles.optionRow}>
                {["1학기", "2학기"].map((s) => (
                  <Pressable key={s} style={[styles.option, form.semester === s && { backgroundColor: C.primary }]}
                    onPress={() => setForm((f) => ({ ...f, semester: s }))}>
                    <Text style={[styles.optionText, form.semester === s && { color: "#fff" }]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Grade Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>성적</Text>
              <View style={styles.gradeGrid}>
                {Object.keys(GRADE_POINTS).map((g) => (
                  <Pressable key={g} style={[styles.gradeOption, form.grade === g && { backgroundColor: GRADE_COLORS[g] }]}
                    onPress={() => setForm((f) => ({ ...f, grade: g }))}>
                    <Text style={[styles.gradeOptionText, form.grade === g && { color: "#fff" }]}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>구분</Text>
              <View style={styles.optionRow}>
                {["전공", "교양", "기타"].map((c) => (
                  <Pressable key={c} style={[styles.option, form.category === c && { backgroundColor: C.primary }]}
                    onPress={() => setForm((f) => ({ ...f, category: c }))}>
                    <Text style={[styles.optionText, form.category === c && { color: "#fff" }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable style={[styles.saveBtn, { backgroundColor: C.primary }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{editing ? "수정 완료" : "추가"}</Text>
            </Pressable>
            {editing && (
              <Pressable style={styles.delBtn} onPress={() => handleDelete(editing.id)}>
                <Text style={styles.delBtnText}>삭제</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function GInput({ label, value, onChangeText, placeholder, keyboardType = "default" }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gpaCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  gpaLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.8)" },
  gpaValue: { fontFamily: "Inter_700Bold", fontSize: 56, color: "#fff", marginVertical: 4 },
  gpaSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)" },
  semSection: { marginBottom: 20 },
  semHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  semTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  semGpa: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.primary },
  gradeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  gradeBar: { width: 4, height: "100%", borderRadius: 2, marginRight: 12 },
  gradeInfo: { flex: 1 },
  gradeName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  gradeMeta: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  gradeValue: { fontFamily: "Inter_700Bold", fontSize: 20 },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 16, color: C.textTertiary },
  fab: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modal: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 12 },
  modalHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  input: { backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 16, color: C.text },
  optionRow: { flexDirection: "row", gap: 8 },
  option: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border },
  optionText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gradeGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeOption: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border },
  gradeOptionText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.textSecondary },
  saveBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 12 },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  delBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.danger, marginBottom: 32 },
  delBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.danger },
});
