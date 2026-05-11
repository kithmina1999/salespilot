import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, styles[tone]]}>
      <Text style={[styles.text, tone === "primary" ? styles.primaryText : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1
  },
  neutral: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  text: {
    ...typography.caption,
    color: colors.text,
    textTransform: "capitalize"
  },
  primaryText: {
    color: colors.inkOnDark
  }
});
