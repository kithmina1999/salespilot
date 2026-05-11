import { StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingCard } from "@/components/ui/LoadingSkeleton";
import { MetricTile } from "@/components/ui/MetricTile";
import { Screen } from "@/components/ui/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import { useHome } from "@/features/home/useHome";
import { strings } from "@/i18n";
import { colors, spacing, typography } from "@/theme";
import { formatCurrency, formatTodayDate } from "@/utils/format";

export default function HomeScreen() {
  const home = useHome();
  const data = home.data;
  const business = data?.business;
  const stats = data?.stats;
  const counts = data?.action_counts;
  const connected = business?.wa_status === "connected";
  const topGap = stats?.top_unmatched?.[0];
  const loadingInitial = home.isLoading && !data;

  return (
    <Screen
      style={styles.screen}
      scroll
      refreshing={home.isFetching}
      onRefresh={() => home.refetch()}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{business?.name ?? strings.appName}</Text>
          <Text style={styles.title}>{strings.home.title}</Text>
          <Text style={styles.date}>{formatTodayDate()}</Text>
          <Text style={styles.subtitle}>{strings.home.subtitle}</Text>
        </View>
        <StatusPill
          label={connected ? strings.home.botConnected : strings.home.botDisconnected}
          tone={connected ? "success" : "warning"}
        />
      </View>

      {home.isError ? (
        <EmptyState title="Could not load today's work" body="Pull to refresh or check your API URL." />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.home.todaysWork}</Text>
        {loadingInitial ? (
          <LoadingCard />
        ) : (
          <View style={styles.grid}>
            <MetricTile label="New orders" value={counts?.new_orders ?? 0} tone="primary" />
            <MetricTile label="Unread chats" value={counts?.unread_chats ?? 0} />
            <MetricTile label="Proof reviews" value={counts?.proof_reviews ?? 0} />
            <MetricTile label="Knowledge gaps" value={counts?.missing_knowledge ?? 0} tone="warning" />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.home.quickActions}</Text>
        <View style={styles.actions}>
          <Link href="/orders" asChild>
            <Button variant="secondary">Review orders</Button>
          </Link>
          <Link href="/products" asChild>
            <Button variant="secondary">Add product</Button>
          </Link>
          <Link href="/inbox" asChild>
            <Button variant="secondary">Open inbox</Button>
          </Link>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.home.summary}</Text>
        {loadingInitial ? (
          <LoadingCard />
        ) : (
          <View style={styles.summary}>
            <MetricTile label="This month revenue" value={formatCurrency(stats?.revenue_this_month)} />
            <MetricTile label="Orders today" value={stats?.orders_today ?? 0} />
            <MetricTile label="AI handled" value={`${Math.round(stats?.bot_automation_pct ?? 0)}%`} />
            <MetricTile label="Products" value={stats?.total_products ?? 0} />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.home.missingKnowledge}</Text>
        {loadingInitial ? (
          <LoadingCard />
        ) : topGap ? (
          <View style={styles.gapCard}>
            <Text style={styles.gapText} numberOfLines={3}>{topGap.message}</Text>
            <Text style={styles.gapCount}>{topGap.count} unanswered customer messages</Text>
          </View>
        ) : (
          <EmptyState title="No knowledge gaps right now" body="The bot has not flagged unresolved customer questions." />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: spacing.xxl
  },
  header: {
    gap: spacing.md
  },
  kicker: {
    ...typography.label,
    color: colors.primary
  },
  title: {
    ...typography.title,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.muted
  },
  date: {
    ...typography.subheading,
    color: colors.text,
    marginTop: spacing.xs
  },
  section: {
    gap: spacing.md
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  actions: {
    gap: spacing.sm
  },
  gapCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm
  },
  gapText: {
    ...typography.body,
    color: colors.text
  },
  gapCount: {
    ...typography.caption,
    color: colors.muted
  }
});
