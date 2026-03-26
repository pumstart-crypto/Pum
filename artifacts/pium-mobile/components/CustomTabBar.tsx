import { Feather } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

const C = Colors.light;

const TABS = [
  { name: "index",     label: "홈",     icon: "home"           as const },
  { name: "timetable", label: "시간표", icon: "calendar"       as const },
  { name: "meal",      label: "학식",   icon: "coffee"         as const },
  { name: "community", label: "커뮤니티", icon: "message-circle" as const },
  { name: "more",      label: "더보기", icon: "grid"           as const },
];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[index];
        const isActive = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isActive && !event.defaultPrevented) {
            if (Platform.OS !== "web") {
              Haptics.selectionAsync();
            }
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityLabel={tab?.label}
          >
            {isActive ? (
              <View style={styles.activePill}>
                <Feather name={tab?.icon ?? "circle"} size={20} color="#fff" />
                <Text style={styles.activeLabel}>{tab?.label}</Text>
              </View>
            ) : (
              <View style={styles.inactiveItem}>
                <Feather name={tab?.icon ?? "circle"} size={22} color={C.textSecondary} />
                <Text style={styles.inactiveLabel}>{tab?.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderColor: "#dde1e7",
    shadowColor: "#00427d",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  activeLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#fff",
    letterSpacing: 0.2,
  },
  inactiveItem: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  inactiveLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: C.textSecondary,
  },
});
