import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { useAuthStore } from "@/store/authStore";
import { colors, spacing, typography } from "@/theme";

export default function MoreScreen() {
  const business = useAuthStore((state) => state.business);
  const signOut = useAuthStore((state) => state.signOut);

  function logout() {
    Alert.alert("Sign out?", "This removes the mobile session from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        }
      }
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>{business?.name ?? "Merchant workspace"}</Text>
      </View>

      <View style={styles.links}>
        <Text style={styles.linkLabel}>Rules</Text>
        <Text style={styles.linkLabel}>Billing and usage</Text>
        <Text style={styles.linkLabel}>Finance</Text>
        <Text style={styles.linkLabel}>Settings</Text>
        <Text style={styles.linkLabel}>Help</Text>
      </View>

      <Button variant="danger" onPress={logout}>
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs
  },
  title: {
    ...typography.title,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.muted
  },
  links: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  linkLabel: {
    ...typography.body,
    color: colors.text,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  }
});
