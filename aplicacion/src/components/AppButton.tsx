import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  disabled?: boolean;
};

export function AppButton({ label, onPress, variant = 'primary', icon, style, disabled = false }: Props) {
  const secondary = variant === 'secondary';
  const ghost = variant === 'ghost';

  return (
    <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, ghost && styles.ghost, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}>
      {icon && <Ionicons style={styles.icon} name={icon} size={20} color={secondary || ghost ? colors.primary : colors.white} />}
      <Text style={[styles.label, (secondary || ghost) && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    minWidth: 0,
    maxWidth: '100%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
  ghost: { backgroundColor: colors.softGreen },
  icon: { flexShrink: 0 },
  label: { flexShrink: 1, color: colors.white, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  secondaryLabel: { color: colors.primary },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 }
});
