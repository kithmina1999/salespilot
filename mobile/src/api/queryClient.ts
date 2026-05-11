import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 30,
      retry: 2
    },
    mutations: {
      retry: 0
    }
  }
});

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  })
);

function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === "active");
}

export function installQueryAppListeners() {
  const subscription = AppState.addEventListener("change", onAppStateChange);
  return () => subscription.remove();
}
