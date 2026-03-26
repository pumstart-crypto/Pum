import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import C from '@/constants/colors';

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

const TAB_ITEMS = [
  { name: 'index',    label: '홈',      iconFill: 'home',          iconOutline: 'home-outline',          sfFill: 'house.fill',           sfOutline: 'house' },
  { name: 'notices',  label: '공지',    iconFill: 'notifications', iconOutline: 'notifications-outline', sfFill: 'bell.fill',            sfOutline: 'bell' },
  { name: 'schedule', label: '시간표',  iconFill: 'calendar',      iconOutline: 'calendar-outline',      sfFill: 'calendar.badge.clock', sfOutline: 'calendar' },
  { name: 'board',    label: '커뮤니티', iconFill: 'people',       iconOutline: 'people-outline',        sfFill: 'person.2.fill',        sfOutline: 'person.2' },
  { name: 'settings', label: '설정',    iconFill: 'settings',      iconOutline: 'settings-outline',      sfFill: 'gearshape.fill',       sfOutline: 'gearshape' },
] as const;

function TabIcon({ label, focused, sfFill, sfOutline, iconFill, iconOutline }: {
  label: string;
  focused: boolean;
  sfFill: string;
  sfOutline: string;
  iconFill: string;
  iconOutline: string;
}) {
  if (focused) {
    return (
      <View style={styles.activePill}>
        {isIOS ? (
          <SymbolView name={sfFill as any} tintColor="#fff" size={20} />
        ) : (
          <Ionicons name={iconFill as any} size={20} color="#fff" />
        )}
        <Text style={styles.activeLabel} numberOfLines={1}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.inactiveItem}>
      {isIOS ? (
        <SymbolView name={sfOutline as any} tintColor="#9CA3AF" size={22} />
      ) : (
        <Ionicons name={iconOutline as any} size={22} color="#9CA3AF" />
      )}
      <Text style={styles.inactiveLabel} numberOfLines={1}>{label}</Text>
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
          borderTopWidth: 0,
          elevation: 0,
          height: isWeb ? 88 : 80,
          paddingTop: 0,
          paddingBottom: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.07,
          shadowRadius: 20,
        },
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 0,
          height: '100%',
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint="light"
              style={[StyleSheet.absoluteFill, styles.tabBarBg]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.tabBarBg, { backgroundColor: '#fff' }]} />
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
  tabBarBg: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },

  activePill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 56,
  },
  activeLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },

  inactiveItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  inactiveLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#9CA3AF',
  },
});
