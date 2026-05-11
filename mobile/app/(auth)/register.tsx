import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { useRegister } from "@/features/auth/useAuthActions";
import { strings } from "@/i18n";
import { colors, spacing, typography } from "@/theme";

export default function RegisterScreen() {
  const register = useRegister();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!businessName.trim() || !email.trim() || !phone.trim() || !password) {
      setError("Fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const data = await register.mutateAsync({ businessName, email, phone, password });
      router.replace({ pathname: "/verify-email", params: { email: data.email || email.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <View style={styles.header}>
          <Text style={styles.brand}>{strings.appName}</Text>
          <Text style={styles.title}>{strings.auth.registerTitle}</Text>
          <Text style={styles.subtitle}>Start with the merchant app. WhatsApp setup can be completed on web.</Text>
        </View>

        <View style={styles.form}>
          <TextField label={strings.auth.businessName} value={businessName} onChangeText={setBusinessName} />
          <TextField label={strings.auth.email} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextField label={strings.auth.phone} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="+94 77 123 4567" />
          <TextField label={strings.auth.password} secureTextEntry value={password} onChangeText={setPassword} />
          <TextField label={strings.auth.confirmPassword} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button onPress={submit} loading={register.isPending}>
            {strings.auth.createAccount}
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/login" style={styles.link}>
            Sign in
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
