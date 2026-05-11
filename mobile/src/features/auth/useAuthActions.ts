import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import type { LoginResponse, RegisterResponse } from "@/api/types";
import { useAuthStore } from "@/store/authStore";
import { normalizePhone } from "@/utils/phone";

type LoginInput = {
  identifier: string;
  password: string;
};

type RegisterInput = {
  businessName: string;
  email: string;
  phone: string;
  password: string;
};

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const data = await apiFetch<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          identifier: input.identifier.trim(),
          password: input.password
        })
      });
      if (!["admin", "owner"].includes(data.user.role)) {
        throw new Error("Mobile v1 is available for owner/admin accounts only.");
      }
      return data;
    },
    onSuccess: async (data) => {
      await setSession(data.token, data.user, data.business);
    }
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch<RegisterResponse>("/api/v1/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          business_name: input.businessName.trim(),
          email: input.email.trim(),
          phone: normalizePhone(input.phone),
          password: input.password
        })
      })
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (input: { email: string; otp: string }) =>
      apiFetch<{ message: string }>("/api/v1/auth/verify-email", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          email: input.email.trim(),
          otp: input.otp.trim()
        })
      })
  });
}
