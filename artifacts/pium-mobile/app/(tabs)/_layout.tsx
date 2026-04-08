import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import C from '@/constants/colors';

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

// iOS HIG: 아이콘 25×25pt, 레이블 10px Medium, 탭바 높이 49px + safeArea
const ICON_SIZE = 25;
const LABEL_SIZE = 10;
const ACTIVE_COLOR = C.primary;
const INACTIVE_COLOR = '#9CA3AF';

const TAB_ITEMS = [
  { name: 'index',    label: '홈',     iconFill: 'home',          iconOutline: 'home-outline',          sfFill: 'house.fill',           sfOutline: 'house' },
  { name: 'notices',  label: '공지',   iconFill: 'notifications', iconOutline: 'notifications-outline', sfFill: 'bell.fill',            sfOutline: 'bell' },
  { name: 'schedule', label: '시간표', iconFill: 'calendar',      iconOutline: 'calendar-outline',      sfFill: 'calendar.badge.clock', sfOutline: 'calendar' },
  { name: 'board',    label: '커뮤',   iconFill: 'people',        iconOutline: 'people-outline',        sfFill: 'person.2.fill',        sfOutline: 'person.2' },
  { name: 'settings', label: '설정',   iconFill: 'settings',      iconOutline: 'settings-outline',      sfFill: 'gearshape.fill',       sfOutline: 'gearshape' },
] as const;

function TabIcon({ label, focused, sfFill, sfOutline, iconFill, iconOutline }: {
  label: string;
  focused: boolean;
  sfFill: string;
  sfOutline: string;
  iconFill: string;
  iconOutline: string;
}) {
  const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <View style={styles.tabItem}>
      {isIOS ? (
        <SymbolView
          name={(focused ? sfFill : sfOutline) as any}
          tintColor={color}
          size={ICON_SIZE}
        />
      ) : (
        <Ionicons
          name={(focused ? iconFill : iconOutline) as any}
          size={ICON_SIZE}
          color={color}
        />
      )}
      <Text style={[styles.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#E5E7EB',
          elevation: 0,
          height: isWeb ? 88 : 83,
          paddingTop: 0,
          paddingBottom: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 49,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={85}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]} />
          ),
      }}
    >
      {TAB_ITEMS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused }) => (
              <TabIcon
                label={tab.label}
                focused={focused}
                sfFill={tab.sfFill}
                sfOutline={tab.sfOutline}
                iconFill={tab.iconFill}
                iconOutline={tab.iconOutline}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    minWidth: 48,
  },
  label: {
    fontSize: LABEL_SIZE,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
