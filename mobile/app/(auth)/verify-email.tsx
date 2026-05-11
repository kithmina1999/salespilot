import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { useVerifyEmail } from "@/features/auth/useAuthActions";
import { strings } from "@/i18n";
import { colors, spacing, typography } from "@/theme";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const verify = useVerifyEmail();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const email = params.email ?? "";

  async function submit() {
    setError("");
    if (!email || !otp.trim()) {
      setError("Enter the verification code from your email.");
      return;
    }

    try {
      await verify.mutateAsync({ email, otp });
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{strings.auth.verifyEmail}</Text>
          <Text style={styles.subtitle}>We sent a code to {email || "your email address"}.</Text>
        </View>
        <TextField label={strings.auth.otp} keyboardType="number-pad" value={otp} onChangeText={setOtp} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button onPress={submit} loading={verify.isPending}>
          Verify and continue
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg
  },
  header: {
    gap: spacing.sm
  },
  title: {
    ...typography.title,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.muted
  },
  error: {
    ...typography.body,
    color: colors.danger
  }
});
