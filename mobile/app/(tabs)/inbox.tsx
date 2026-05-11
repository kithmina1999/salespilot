import { StyleSheet, Text } from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { colors, spacing, typography } from "@/theme";

export default function InboxScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Inbox</Text>
      <EmptyState
        title="Inbox comes after the order slice"
        body="The shell is ready for native thread lists, chat detail, quick replies, and bot pause controls."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm
  }
});
