import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="grades" options={{ headerShown: true, title: "성적", headerBackTitle: "" }} />
          <Stack.Screen name="budget" options={{ headerShown: true, title: "가계부", headerBackTitle: "" }} />
          <Stack.Screen name="bus" options={{ headerShown: true, title: "버스", headerBackTitle: "" }} />
          <Stack.Screen name="calendar" options={{ headerShown: true, title: "학사일정", headerBackTitle: "" }} />
          <Stack.Screen name="map" options={{ headerShown: true, title: "캠퍼스맵", headerBackTitle: "" }} />
          <Stack.Screen name="notices" options={{ headerShown: true, title: "공지사항", headerBackTitle: "" }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: "설정", headerBackTitle: "" }} />
          <Stack.Screen name="community/[id]" options={{ headerShown: true, title: "", headerBackTitle: "" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Redirect href="/login" />
        </>
      )}
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
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
