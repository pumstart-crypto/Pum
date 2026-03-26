import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
setAuthTokenGetter(async () => {
  try { return await AsyncStorage.getItem('campus_life_token'); }
  catch { return null; }
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === 'login' || segments[0] === 'register';
    if (!user && !inAuth) {
      router.replace('/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="meals" options={{ presentation: 'card' }} />
      <Stack.Screen name="bus" options={{ presentation: 'card' }} />
      <Stack.Screen name="finance" options={{ presentation: 'card' }} />
      <Stack.Screen name="academic-calendar" options={{ presentation: 'card' }} />
      <Stack.Screen name="campus-map" options={{ presentation: 'card' }} />
      <Stack.Screen name="profile-edit" options={{ presentation: 'card' }} />
      <Stack.Screen name="notification-settings" options={{ presentation: 'card' }} />
      <Stack.Screen name="privacy-settings" options={{ presentation: 'card' }} />
      <Stack.Screen name="notifications-inbox" options={{ presentation: 'card' }} />
      <Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="restaurant/index" options={{ presentation: 'card' }} />
      <Stack.Screen name="restaurant/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
