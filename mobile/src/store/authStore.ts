import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { Business, User } from "@/api/types";

const TOKEN_KEY = "salespilot.access_token";
const USER_KEY = "salespilot.user";
const BUSINESS_KEY = "salespilot.business";

type AuthState = {
  token: string | null;
  user: User | null;
  business: Business | null;
  hydrated: boolean;
  setSession: (token: string, user: User, business: Business) => Promise<void>;
  hydrate: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  business: null,
  hydrated: false,
  async setSession(token, user, business) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    await SecureStore.setItemAsync(BUSINESS_KEY, JSON.stringify(business));
    set({ token, user, business, hydrated: true });
  },
  async hydrate() {
    const [token, rawUser, rawBusiness] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
      SecureStore.getItemAsync(BUSINESS_KEY)
    ]);

    set({
      token,
      user: rawUser ? (JSON.parse(rawUser) as User) : null,
      business: rawBusiness ? (JSON.parse(rawBusiness) as Business) : null,
      hydrated: true
    });
  },
  async signOut() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
      SecureStore.deleteItemAsync(BUSINESS_KEY)
    ]);
    set({ token: null, user: null, business: null, hydrated: true });
  }
}));
