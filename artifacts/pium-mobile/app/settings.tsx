import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [scheduleNotif, setScheduleNotif] = useState(true);
  const [mealNotif, setMealNotif] = useState(false);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateUser({ name: nameInput.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditingName(false);
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <View style={styles.section}>
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: C.primary }]}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.username || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  onSubmitEditing={handleSaveName}
                />
                <Pressable onPress={handleSaveName}>
                  <Feather name="check" size={20} color={C.primary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.nameRow}
                onPress={() => { setEditingName(true); setNameInput(user?.name || ""); }}
              >
                <Text style={styles.profileName}>{user?.name || user?.username}</Text>
                <Feather name="edit-2" size={16} color={C.textTertiary} />
              </Pressable>
            )}
            <Text style={styles.profileId}>@{user?.username}</Text>
          </View>
        </View>
      </View>

      {/* Account Info */}
      <SectionTitle title="계정 정보" />
      <View style={styles.group}>
        <InfoRow label="학번" value={user?.studentId || "미등록"} />
        <InfoRow label="학과" value={user?.department || "미등록"} />
        <InfoRow label="전화번호" value={user?.phone || "미등록"} />
      </View>

      {/* Notification Settings */}
      <SectionTitle title="알림 설정" />
      <View style={styles.group}>
        <ToggleRow
          label="푸시 알림"
          icon="bell"
          value={pushEnabled}
          onChange={(v) => { setPushEnabled(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        />
        <ToggleRow
          label="수업 알림"
          icon="calendar"
          value={scheduleNotif}
          onChange={(v) => { setScheduleNotif(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        />
        <ToggleRow
          label="학식 업데이트"
          icon="coffee"
          value={mealNotif}
          onChange={(v) => { setMealNotif(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        />
      </View>

      {/* App Info */}
      <SectionTitle title="앱 정보" />
      <View style={styles.group}>
        <InfoRow label="버전" value="1.0.0" />
        <InfoRow label="개발" value="P:um Team" />
        <InfoRow label="학교" value="부산대학교" />
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Feather name="log-out" size={18} color={C.danger} />
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ label, icon, value, onChange }: {
  label: string; icon: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Feather name={icon as any} size={18} color={C.textSecondary} style={{ marginRight: 10 }} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: C.text,
    borderBottomWidth: 1,
    borderColor: C.primary,
    paddingVertical: 2,
  },
  profileName: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: C.text },
  profileId: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    paddingLeft: 4,
  },
  group: {
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderColor: C.borderLight,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  rowLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.text },
  rowValue: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textSecondary },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.danger },
});
