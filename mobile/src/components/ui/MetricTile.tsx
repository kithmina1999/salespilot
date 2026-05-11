import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme";

type MetricTileProps = {
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "warning";
};

export function MetricTile({ label, value, tone = "default" }: MetricTileProps) {
  return (
    <View style={[styles.wrap, tone === "primary" ? styles.primary : null, tone === "warning" ? styles.warning : null]}>
      <Text style={[styles.value, tone === "primary" ? styles.light : null]}>{value}</Text>
      <Text style={[styles.label, tone === "primary" ? styles.lightMuted : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft
  },
  value: {
    ...typography.heading,
    color: colors.text
  },
  label: {
    ...typography.caption,
    color: colors.muted
  },
  light: {
    color: colors.inkOnDark
  },
  lightMuted: {
    color: colors.primarySoft
  }
});
