import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
const DAYS = ["월", "화", "수", "목", "금"];
const DAY_MAP = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316",
];

const TIMES = Array.from({ length: 14 }, (_, i) => `${i + 9}:00`);
const TIME_START = 9;
const CELL_HEIGHT = 56;

interface Schedule {
  id: number;
  subjectName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  professor?: string;
  color?: string;
}

function timeToDecimal(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

export default function TimetableScreen() {
  const insets = useSafeAreaInsets();
  const apiUrl = useApiUrl();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const [form, setForm] = useState({
    subjectName: "",
    dayOfWeek: "1",
    startTime: "09:00",
    endTime: "10:30",
    location: "",
    professor: "",
    color: COLORS[0],
  });

  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : 100;

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${apiUrl}/schedule`);
      if (res.ok) setSchedules(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      subjectName: "",
      dayOfWeek: "1",
      startTime: "09:00",
      endTime: "10:30",
      location: "",
      professor: "",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setForm({
      subjectName: s.subjectName,
      dayOfWeek: String(s.dayOfWeek),
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location || "",
      professor: s.professor || "",
      color: s.color || COLORS[0],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.subjectName.trim()) return;
    const body = {
      subjectName: form.subjectName,
      dayOfWeek: parseInt(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location || null,
      professor: form.professor || null,
      color: form.color,
    };
    try {
      if (editing) {
        const res = await fetch(`${apiUrl}/schedule/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const updated = await res.json();
          setSchedules((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
        }
      } else {
        const res = await fetch(`${apiUrl}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = await res.json();
          setSchedules((prev) => [...prev, created]);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setShowModal(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert("삭제", "이 수업을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await fetch(`${apiUrl}/schedule/${id}`, { method: "DELETE" });
          setSchedules((prev) => prev.filter((s) => s.id !== id));
          setShowModal(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={styles.headerTitle}>시간표</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Feather name="plus" size={22} color={C.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPadding }}>
          {/* Grid */}
          <View style={styles.grid}>
            {/* Day headers */}
            <View style={styles.dayHeaders}>
              <View style={styles.timeCol} />
              {DAYS.map((d) => (
                <View key={d} style={styles.dayHeader}>
                  <Text style={styles.dayText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Time rows */}
            <View style={styles.rows}>
              <View style={styles.timeColFull}>
                {TIMES.map((t) => (
                  <View key={t} style={[styles.timeCell, { height: CELL_HEIGHT }]}>
                    <Text style={styles.timeText}>{t}</Text>
                  </View>
                ))}
              </View>

              {/* Day columns */}
              {DAYS.map((d, di) => {
                const daySchedules = schedules.filter(
                  (s) => s.dayOfWeek === DAY_MAP[d as keyof typeof DAY_MAP]
                );
                return (
                  <View key={d} style={styles.dayCol}>
                    {TIMES.map((t, ti) => (
                      <View
                        key={t}
                        style={[
                          styles.gridCell,
                          { height: CELL_HEIGHT },
                          ti < TIMES.length - 1 && styles.cellBorderBottom,
                        ]}
                      />
                    ))}
                    {daySchedules.map((s) => {
                      const startD = timeToDecimal(s.startTime);
                      const endD = timeToDecimal(s.endTime);
                      const top = (startD - TIME_START) * CELL_HEIGHT;
                      const height = (endD - startD) * CELL_HEIGHT;
                      return (
                        <Pressable
                          key={s.id}
                          style={[
                            styles.scheduleBlock,
                            {
                              top,
                              height: height - 2,
                              backgroundColor: s.color || C.primary,
                            },
                          ]}
                          onPress={() => openEdit(s)}
                        >
                          <Text style={styles.blockName} numberOfLines={2}>
                            {s.subjectName}
                          </Text>
                          {s.location && (
                            <Text style={styles.blockLoc} numberOfLines={1}>
                              {s.location}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? "수업 수정" : "수업 추가"}</Text>
            <Pressable onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={C.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ModalInput label="과목명" value={form.subjectName} onChangeText={(t) => setForm((f) => ({ ...f, subjectName: t }))} placeholder="과목명을 입력하세요" />

            {/* Day Selector */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>요일</Text>
              <View style={styles.daySelector}>
                {DAYS.map((d, i) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.dayOption,
                      String(i + 1) === form.dayOfWeek && { backgroundColor: C.primary },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, dayOfWeek: String(i + 1) }))}
                  >
                    <Text style={[styles.dayOptionText, String(i + 1) === form.dayOfWeek && { color: "#fff" }]}>
                      {d}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <ModalInput label="시작 시간" value={form.startTime} onChangeText={(t) => setForm((f) => ({ ...f, startTime: t }))} placeholder="09:00" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <ModalInput label="종료 시간" value={form.endTime} onChangeText={(t) => setForm((f) => ({ ...f, endTime: t }))} placeholder="10:30" keyboardType="numbers-and-punctuation" />
              </View>
            </View>

            <ModalInput label="강의실 (선택)" value={form.location} onChangeText={(t) => setForm((f) => ({ ...f, location: t }))} placeholder="건물명 및 호수" />
            <ModalInput label="교수님 (선택)" value={form.professor} onChangeText={(t) => setForm((f) => ({ ...f, professor: t }))} placeholder="교수님 성함" />

            {/* Color Picker */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>색상</Text>
              <View style={styles.colorRow}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      form.color === c && styles.colorDotSelected,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.saveBtn, { backgroundColor: C.primary }]}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>{editing ? "수정 완료" : "수업 추가"}</Text>
            </Pressable>

            {editing && (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => handleDelete(editing.id)}
              >
                <Text style={styles.deleteBtnText}>삭제</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function ModalInput({ label, value, onChangeText, placeholder, keyboardType = "default" }: any) {
  return (
    <View style={styles.modalField}>
      <Text style={styles.modalLabel}>{label}</Text>
      <TextInput
        style={styles.modalInput}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.background,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  dayHeaders: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  timeCol: {
    width: 44,
  },
  dayHeader: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  dayText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textSecondary,
  },
  rows: {
    flexDirection: "row",
  },
  timeColFull: {
    width: 44,
  },
  timeCell: {
    justifyContent: "flex-start",
    paddingTop: 4,
    paddingLeft: 4,
    borderBottomWidth: 0.5,
    borderColor: C.borderLight,
  },
  timeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: C.textTertiary,
  },
  dayCol: {
    flex: 1,
    position: "relative",
    borderLeftWidth: 0.5,
    borderColor: C.borderLight,
  },
  gridCell: {
    borderBottomWidth: 0.5,
    borderColor: C.borderLight,
  },
  cellBorderBottom: {},
  scheduleBlock: {
    position: "absolute",
    left: 2,
    right: 2,
    borderRadius: 6,
    padding: 4,
    overflow: "hidden",
  },
  blockName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#fff",
  },
  blockLoc: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: "rgba(255,255,255,0.8)",
  },
  modal: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.text,
  },
  modalBody: {
    flex: 1,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.text,
  },
  daySelector: {
    flexDirection: "row",
    gap: 8,
  },
  dayOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayOptionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textSecondary,
  },
  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  deleteBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.danger,
    marginBottom: 32,
  },
  deleteBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.danger,
  },
});
