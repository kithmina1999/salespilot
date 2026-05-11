import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Order, OrderStatus } from "@/api/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingCard } from "@/components/ui/LoadingSkeleton";
import { Screen } from "@/components/ui/Screen";
import { OrderCard } from "@/components/orders/OrderCard";
import { orderStatuses, useOrders, useUpdateOrderStatus } from "@/features/orders/useOrders";
import { strings } from "@/i18n";
import { colors, spacing, typography } from "@/theme";

function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === "new") return "confirmed";
  if (status === "confirmed") return "shipped";
  if (status === "shipped") return "delivered";
  return null;
}

function actionLabel(status: OrderStatus) {
  if (status === "new") return strings.orders.confirm;
  if (status === "confirmed") return strings.orders.ship;
  if (status === "shipped") return strings.orders.deliver;
  return null;
}

export default function OrdersScreen() {
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const orders = useOrders(status);
  const updateStatus = useUpdateOrderStatus(status);

  const filteredOrders = useMemo(() => orders.data ?? [], [orders.data]);
  const loadingInitial = orders.isLoading && !orders.data;

  function confirmNext(order: Order) {
    const target = nextStatus(order.status);
    const label = actionLabel(order.status);
    if (!target || !label) return;

    Alert.alert(`${label} order #${order.order_num || order.id}?`, "The customer notification behavior will match the web dashboard.", [
      { text: "Not now", style: "cancel" },
      {
        text: label,
        onPress: () => updateStatus.mutate({ order, status: target })
      }
    ]);
  }

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{strings.orders.title}</Text>
        <Text style={styles.subtitle}>Filter, scan, and move orders through fulfillment.</Text>
      </View>

      <View style={styles.filters}>
        {orderStatuses.map((item) => {
          const selected = item.value === status || (!item.value && !status);
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              onPress={() => setStatus(item.value)}
              style={[styles.filter, selected ? styles.filterActive : null]}
            >
              <Text style={[styles.filterText, selected ? styles.filterTextActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => String(item.id)}
        refreshControl={undefined}
        refreshing={orders.isFetching}
        onRefresh={() => orders.refetch()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <OrderCard order={item} onPrimaryAction={nextStatus(item.status) ? () => confirmNext(item) : undefined} />
        )}
        ListEmptyComponent={
          loadingInitial ? (
            <View style={styles.loadingList}>
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </View>
          ) : (
            <EmptyState
              title={strings.orders.empty}
              body="Try a different status filter or pull to refresh."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0
  },
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
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  filter: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    ...typography.label,
    color: colors.text
  },
  filterTextActive: {
    color: colors.inkOnDark
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl
  },
  loadingList: {
    gap: spacing.md
  }
});
