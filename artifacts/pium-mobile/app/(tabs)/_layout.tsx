import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import C from '@/constants/colors';

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : '#fff',
          borderTopWidth: 0,
          elevation: 0,
          height: isWeb ? 84 : 80,
          paddingBottom: isWeb ? 34 : 20,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'house.fill' : 'house'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="notices"
        options={{
          title: '공지',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'bell.fill' : 'bell'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '시간표',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'calendar.badge.clock' : 'calendar'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: '커뮤니티',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'person.2.fill' : 'person.2'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'gearshape.fill' : 'gearshape'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
