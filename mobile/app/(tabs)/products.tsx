import { StyleSheet, Text } from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { colors, spacing, typography } from "@/theme";

export default function ProductsScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Products</Text>
      <EmptyState
        title="Camera-first products are next"
        body="This tab is reserved for catalog list, add/edit product, image picker, stock sheet, and active toggle."
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
