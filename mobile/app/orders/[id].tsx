import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import type { OrderStatus } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingCard } from "@/components/ui/LoadingSkeleton";
import { Screen } from "@/components/ui/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import { useOrders, useUpdateOrderStatus } from "@/features/orders/useOrders";
import { colors, spacing, typography } from "@/theme";
import { formatCurrency, formatDateTime } from "@/utils/format";

function parseItems(items: string) {
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nextStatus(status?: OrderStatus): OrderStatus | null {
  if (status === "new") return "confirmed";
  if (status === "confirmed") return "shipped";
  if (status === "shipped") return "delivered";
  return null;
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const orders = useOrders();
  const updateStatus = useUpdateOrderStatus();
  const order = orders.data?.find((item) => item.id === id);
  const items = order ? parseItems(order.items) : [];
  const target = nextStatus(order?.status);

  function confirmStatus(status: OrderStatus) {
    if (!order) return;
    Alert.alert(`Move order to ${status}?`, "The backend will reuse existing customer notification behavior.", [
      { text: "Cancel", style: "cancel" },
      { text: "Update", onPress: () => updateStatus.mutate({ order, status }) }
    ]);
  }

  if (!order && !orders.isLoading) {
    return (
      <Screen>
        <EmptyState title="Order not found" body="Pull the orders list again, then reopen the order." />
        <Button variant="secondary" onPress={() => router.back()}>
          Back
        </Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Button variant="ghost" onPress={() => router.back()}>
          Back
        </Button>
        <Text style={styles.title}>Order #{order?.order_num || order?.id || id}</Text>
        <Text style={styles.subtitle}>{order?.customer_name || order?.customer_phone}</Text>
      </View>

      {order ? (
        <>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <StatusPill label={order.status} tone={order.status === "new" ? "primary" : "neutral"} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Payment</Text>
              <StatusPill label={order.payment_status || "pending"} tone={order.payment_status === "paid" ? "success" : "warning"} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total</Text>
              <Text style={styles.value}>{formatCurrency(order.total_price)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Created</Text>
              <Text style={styles.value}>{formatDateTime(order.created_at)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.value}>{order.customer_phone}</Text>
            {order.address ? <Text style={styles.body}>{order.address}</Text> : null}
            {order.notes ? <Text style={styles.body}>{order.notes}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Items</Text>
            {items.length ? (
              items.map((item, index) => (
                <Text key={`${index}`} style={styles.body}>
                  {typeof item === "string" ? item : JSON.stringify(item)}
                </Text>
              ))
            ) : (
              <Text style={styles.body}>{order.items || "No item detail"}</Text>
            )}
          </View>

          {target ? (
            <Button onPress={() => confirmStatus(target)} loading={updateStatus.isPending}>
              Move to {target}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <LoadingCard />
          <LoadingCard />
        </>
      )}
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
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md
  },
  cardTitle: {
    ...typography.subheading,
    color: colors.text
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  label: {
    ...typography.label,
    color: colors.muted
  },
  value: {
    ...typography.body,
    color: colors.text
  },
  body: {
    ...typography.body,
    color: colors.muted
  }
});
