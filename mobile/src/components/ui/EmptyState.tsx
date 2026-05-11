import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme";

type EmptyStateProps = {
  title: string;
  body?: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.xl,
    gap: spacing.sm
  },
  title: {
    ...typography.subheading,
    color: colors.text
  },
  body: {
    ...typography.body,
    color: colors.muted
  }
});
