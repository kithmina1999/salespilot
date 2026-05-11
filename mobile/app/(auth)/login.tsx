import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { useLogin } from "@/features/auth/useAuthActions";
import { registerPushTokenAfterLogin } from "@/features/notifications/registerPush";
import { strings } from "@/i18n";
import { colors, spacing, typography } from "@/theme";

export default function LoginScreen() {
  const login = useLogin();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!identifier.trim() || !password) {
      setError("Enter your email/phone and password.");
      return;
    }

    try {
      await login.mutateAsync({ identifier, password });
      registerPushTokenAfterLogin().catch(() => null);
      router.replace("/home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        router.push({ pathname: "/verify-email", params: { email: identifier.trim() } });
        return;
      }
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <View style={styles.header}>
          <Text style={styles.brand}>{strings.appName}</Text>
          <Text style={styles.title}>{strings.auth.loginTitle}</Text>
          <Text style={styles.subtitle}>Check orders, inbox, products, and alerts from your phone.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label={strings.auth.identifier}
            autoCapitalize="none"
            autoComplete="username"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="you@company.com or +94..."
          />
          <TextField
            label={strings.auth.password}
            secureTextEntry
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button onPress={submit} loading={login.isPending}>
            {strings.auth.signIn}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to SalesPilot?</Text>
          <Link href="/register" style={styles.link}>
            Create an account
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xl
  },
  header: {
    gap: spacing.sm
  },
  brand: {
    ...typography.label,
    color: colors.primary,
    textTransform: "uppercase"
  },
  title: {
    ...typography.title,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.muted
  },
  form: {
    gap: spacing.lg
  },
  error: {
    ...typography.body,
    color: colors.danger
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center"
  },
  footerText: {
    ...typography.body,
    color: colors.muted
  },
  link: {
    ...typography.label,
    color: colors.primary
  }
});
