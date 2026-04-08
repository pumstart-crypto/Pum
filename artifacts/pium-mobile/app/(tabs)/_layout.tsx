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
  { name: 'index',    label: '홈',       sfSymbol: 'house',     ionicon: 'home-outline' },
  { name: 'notices',  label: '공지',     sfSymbol: 'bell',      ionicon: 'notifications-outline' },
  { name: 'schedule', label: '시간표',   sfSymbol: 'calendar',  ionicon: 'calendar-outline' },
  { name: 'board',    label: '커뮤니티', sfSymbol: 'person.2',  ionicon: 'people-outline' },
  { name: 'settings', label: '설정',     sfSymbol: 'gearshape', ionicon: 'settings-outline' },
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
                  name={(focused ? tab.sfSymbol + '.fill' : tab.sfSymbol) as any}
                  tintColor={color}
                  size={ICON_SIZE}
                />
              ) : (
                <Ionicons
                  name={(focused
                    ? tab.ionicon.replace('-outline', '')
                    : tab.ionicon) as any}
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
