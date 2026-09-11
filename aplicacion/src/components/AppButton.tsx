import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'secondary'; icon?: keyof typeof Ionicons.glyphMap };
export function AppButton({ label, onPress, variant = 'primary', icon }: Props) {
  const secondary = variant === 'secondary';
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed]}>{icon && <Ionicons name={icon} size={20} color={secondary ? colors.primary : colors.white} />}<Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary }, label: { color: colors.white, fontSize: 16, fontWeight: '700' }, secondaryLabel: { color: colors.primary }, pressed: { opacity: 0.82 } });
