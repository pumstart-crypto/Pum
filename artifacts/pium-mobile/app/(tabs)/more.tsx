import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

const MENU_SECTIONS = [
  {
    title: "학업",
    items: [
      { label: "성적 관리", icon: "award", route: "/grades", color: "#8B5CF6" },
      { label: "학사일정", icon: "book-open", route: "/calendar", color: "#F59E0B" },
    ],
  },
  {
    title: "생활",
    items: [
      { label: "가계부", icon: "credit-card", route: "/budget", color: "#10B981" },
      { label: "버스 정보", icon: "navigation", route: "/bus", color: "#3B82F6" },
      { label: "캠퍼스맵", icon: "map", route: "/map", color: "#EC4899" },
    ],
  },
  {
    title: "정보",
    items: [
      { label: "공지사항", icon: "bell", route: "/notices", color: "#EF4444" },
    ],
  },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const isWeb = Platform.OS === "web";
  const topPadding = isWeb ? 67 : insets.top;
  const bottomPadding = isWeb ? 34 : 100;

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.background }}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={styles.headerTitle}>더보기</Text>
        <Pressable onPress={() => router.push("/settings")}>
          <Feather name="settings" size={22} color={C.textSecondary} />
        </Pressable>
      </View>

      {/* Profile Card */}
      <Pressable
        style={styles.profileCard}
        onPress={() => router.push("/settings")}
      >
        <View style={[styles.avatar, { backgroundColor: C.primary }]}>
          <Text style={styles.avatarText}>
            {(user?.name || user?.username || "?")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || user?.username}</Text>
          <Text style={styles.profileSub}>
            {user?.studentId ? `학번 ${user.studentId}` : "학번 미등록"} · {user?.department || "학과 미등록"}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.textTertiary} />
      </Pressable>

      {/* Menu Sections */}
      {MENU_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuGroup}>
            {section.items.map((item, idx) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.menuItem,
                  idx === 0 && styles.menuItemFirst,
                  idx === section.items.length - 1 && styles.menuItemLast,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(item.route as any);
                }}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + "20" }]}>
                  <Feather name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Feather name="chevron-right" size={18} color={C.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <View style={[styles.section, { marginBottom: 16 }]}>
        <View style={styles.menuGroup}>
          <Pressable
            style={[styles.menuItem, styles.menuItemFirst, styles.menuItemLast]}
            onPress={handleLogout}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#FEE2E2" }]}>
              <Feather name="log-out" size={20} color={C.danger} />
            </View>
            <Text style={[styles.menuLabel, { color: C.danger }]}>로그아웃</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>P:um 피움 · 부산대학교</Text>
        <Text style={styles.footerVersion}>v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.background,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: C.text,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#fff",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: C.text,
    marginBottom: 3,
  },
  profileSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuGroup: {
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderColor: C.borderLight,
  },
  menuItemFirst: {
    borderTopWidth: 0,
  },
  menuItemLast: {},
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: C.text,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  footerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textTertiary,
  },
  footerVersion: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textTertiary,
  },
});
