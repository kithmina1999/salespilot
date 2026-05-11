import "react-native-gesture-handler";
import { useEffect } from "react";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient, installQueryAppListeners } from "@/api/queryClient";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    const uninstall = installQueryAppListeners();
    hydrate().catch(() => null);
    return uninstall;
  }, [hydrate]);

  useEffect(() => {
    if (Constants.appOwnership === "expo") return;

    import("expo-notifications")
      .then((Notifications) => {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true
          })
        });
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => null);
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="orders/[id]" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
