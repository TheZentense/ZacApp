import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}><Ionicons name="file-tray-outline" size={28} color={colors.secondary} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  title: { width: '100%', color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  description: { width: '100%', color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420 }
});
