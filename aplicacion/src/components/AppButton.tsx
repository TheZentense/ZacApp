import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
};

export function AppButton({ label, onPress, variant = 'primary', icon, style }: Props) {
  const secondary = variant === 'secondary';
  const ghost = variant === 'ghost';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, ghost && styles.ghost, pressed && styles.pressed, style]}>
      {icon && <Ionicons name={icon} size={20} color={secondary || ghost ? colors.primary : colors.white} />}
      <Text style={[styles.label, (secondary || ghost) && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
  ghost: { backgroundColor: colors.softGreen },
  label: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: colors.primary },
  pressed: { opacity: 0.82 }
});
