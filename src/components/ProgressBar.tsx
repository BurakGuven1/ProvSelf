import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
  labelFormat?: (progress: number) => string;
}

export default function ProgressBar({
  progress,
  color = colors.primary,
  height = 6,
  showLabel = false,
  labelFormat,
}: ProgressBarProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: clampedProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, animValue]);

  const widthInterp = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const label = labelFormat
    ? labelFormat(clampedProgress)
    : `${Math.round(clampedProgress * 100)}%`;

  return (
    <View style={styles.wrapper} accessibilityLabel={`Progress: ${label}`}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthInterp,
              height,
              borderRadius: height / 2,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  track: {
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  label: {
    ...typography.caption1,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});
