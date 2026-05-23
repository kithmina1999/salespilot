"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { setToken } from "./api";

export interface AdminProfile {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  admin: AdminProfile | null;
  isAuthenticated: boolean;
  login: (token: string, admin: AdminProfile) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  // Tokens are strictly in memory, so a fresh page load always starts logged out.
  const isLoading = false;

  const login = (newToken: string, newAdmin: AdminProfile) => {
    setTokenState(newToken);
    setAdmin(newAdmin);
    setToken(newToken);
  };

  const logout = () => {
    setTokenState(null);
    setAdmin(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        admin,
        isAuthenticated: !!token,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
