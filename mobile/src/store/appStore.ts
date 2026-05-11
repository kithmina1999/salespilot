import { create } from "zustand";

type AppState = {
  language: "en";
  hasAskedPushPermission: boolean;
  setHasAskedPushPermission: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  language: "en",
  hasAskedPushPermission: false,
  setHasAskedPushPermission: (hasAskedPushPermission) => set({ hasAskedPushPermission })
}));
