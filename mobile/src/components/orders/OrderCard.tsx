import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import type { Order } from "@/api/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { colors, spacing, typography } from "@/theme";
import { formatAge, formatCurrency } from "@/utils/format";

type OrderCardProps = {
  order: Order;
  onPrimaryAction?: () => void;
};

function toneForStatus(status: string) {
  if (status === "new") return "primary" as const;
  if (status === "delivered") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "shipped") return "warning" as const;
  return "neutral" as const;
}

export function OrderCard({ order, onPrimaryAction }: OrderCardProps) {
  return (
    <Link href={`/orders/${order.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
        <View style={styles.topRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.orderNo}>Order #{order.order_num || order.id}</Text>
            <Text style={styles.customer} numberOfLines={1}>
              {order.customer_name || order.customer_phone}
            </Text>
          </View>
          <Text style={styles.amount}>{formatCurrency(order.total_price)}</Text>
        </View>

        <View style={styles.metaRow}>
          <StatusPill label={order.status} tone={toneForStatus(order.status)} />
          <StatusPill label={order.payment_status || "pending"} tone={order.payment_status === "paid" ? "success" : "neutral"} />
          {order.late_alert_sent ? null : order.status === "shipped" ? (
            <StatusPill label="late alert on" tone="warning" />
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.time}>{formatAge(order.created_at)}</Text>
          {onPrimaryAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={(event) => {
                event.stopPropagation();
                onPrimaryAction();
              }}
              style={styles.action}
            >
              <Text style={styles.actionText}>Next step</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md
  },
  pressed: {
    transform: [{ scale: 0.995 }]
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  titleWrap: {
    flex: 1,
    gap: spacing.xs
  },
  orderNo: {
    ...typography.subheading,
    color: colors.text
  },
  customer: {
    ...typography.body,
    color: colors.muted
  },
  amount: {
    ...typography.subheading,
    color: colors.text
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  time: {
    ...typography.caption,
    color: colors.muted
  },
  action: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md
  },
  actionText: {
    ...typography.label,
    color: colors.primaryDark
  }
});
