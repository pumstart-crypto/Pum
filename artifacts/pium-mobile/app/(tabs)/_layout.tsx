import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import C from '@/constants/colors';

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

const ICON_SIZE = 24;
const ACTIVE_COLOR = C.primary;
const INACTIVE_COLOR = '#9CA3AF';

const TAB_ITEMS = [
  { name: 'index',    label: '홈',       sfActive: 'house.fill',      sfInactive: 'house',      ionActive: 'home',          ionInactive: 'home-outline' },
  { name: 'notices',  label: '공지',     sfActive: 'bell.fill',       sfInactive: 'bell',       ionActive: 'notifications', ionInactive: 'notifications-outline' },
  { name: 'schedule', label: '시간표',   sfActive: 'calendar',        sfInactive: 'calendar',   ionActive: 'calendar',      ionInactive: 'calendar-outline' },
  { name: 'board',    label: '커뮤니티', sfActive: 'person.2.fill',   sfInactive: 'person.2',   ionActive: 'people',        ionInactive: 'people-outline' },
  { name: 'settings', label: '설정',     sfActive: 'gearshape.fill',  sfInactive: 'gearshape',  ionActive: 'settings',      ionInactive: 'settings-outline' },
] as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter_500Medium',
          marginTop: 2,
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#E5E7EB',
          elevation: 0,
          height: isWeb ? 88 : 83,
          paddingBottom: 0,
          paddingTop: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 0,
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
            tabBarIcon: ({ color, focused }) =>
              isIOS ? (
                <SymbolView
                  name={(focused ? tab.sfActive : tab.sfInactive) as any}
                  tintColor={color}
                  size={ICON_SIZE}
                />
              ) : (
                <Ionicons
                  name={(focused ? tab.ionActive : tab.ionInactive) as any}
                  size={ICON_SIZE}
                  color={color}
                />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({});
