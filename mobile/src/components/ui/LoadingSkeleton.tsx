import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, spacing } from "@/theme";

type LoadingSkeletonProps = {
  rows?: number;
  style?: ViewStyle;
};

export function LoadingSkeleton({ rows = 3, style }: LoadingSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 650,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true
        })
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={[styles.wrap, style]}>
      {Array.from({ length: rows }).map((_, index) => (
        <Animated.View key={index} style={[styles.row, index % 2 ? styles.shortRow : null, { opacity }]} />
      ))}
    </View>
  );
}

export function LoadingCard() {
  return (
    <View style={styles.card}>
      <LoadingSkeleton rows={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg
  },
  row: {
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.faint
  },
  shortRow: {
    width: "68%"
  }
});
