import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  KeyboardTypeOptions,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/src/constants/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: KeyboardTypeOptions;
  icon?: React.ReactNode;
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  icon,
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const hasValue = value.length > 0;
  const isActive = isFocused || hasValue;

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: isActive ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isActive, labelAnim]);

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 8],
  });

  const labelSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [typography.body.fontSize, typography.caption1.fontSize],
  });

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          isFocused && styles.focused,
          error && styles.error,
        ]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.inputWrapper}>
          {label && (
            <Animated.Text
              style={[
                styles.label,
                {
                  top: labelTop,
                  fontSize: labelSize,
                  color: error
                    ? colors.danger
                    : isFocused
                      ? colors.accent
                      : colors.textSecondary,
                },
              ]}
              pointerEvents="none"
            >
              {label}
            </Animated.Text>
          )}
          <TextInput
            style={[styles.input, label && styles.inputWithLabel]}
            value={value}
            onChangeText={onChangeText}
            placeholder={isActive ? placeholder : undefined}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            accessibilityLabel={label || placeholder}
          />
        </View>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.transparent,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.white,
  },
  error: {
    borderColor: colors.danger,
  },
  icon: {
    marginRight: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 0,
    fontWeight: '500',
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  inputWithLabel: {
    paddingTop: spacing.md + 4,
    paddingBottom: spacing.xs,
  },
  errorText: {
    ...typography.caption1,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
