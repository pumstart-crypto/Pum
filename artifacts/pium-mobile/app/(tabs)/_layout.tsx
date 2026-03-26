import { Tabs } from "expo-router";
import React from "react";

import { CustomTabBar } from "@/components/CustomTabBar";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="timetable" />
      <Tabs.Screen name="meal" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
