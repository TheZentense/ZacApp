import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';

export function LoadingState({ label = 'Consultando reportes...' }: { label?: string }) {
  return <View style={styles.card}><ActivityIndicator size="large" color={colors.secondary} /><Text style={styles.description}>{label}</Text></View>;
}

export function ErrorState({ description, onRetry }: { description: string; onRetry: () => void }) {
  return <View style={styles.card}>
    <View style={[styles.icon, styles.errorIcon]}><Ionicons name="cloud-offline-outline" size={27} color={colors.danger} /></View>
    <Text style={styles.title}>Consulta no disponible</Text>
    <Text style={styles.description}>{description}</Text>
    <Pressable accessibilityRole="button" style={styles.retry} onPress={onRetry}><Ionicons name="refresh" size={17} color={colors.white} /><Text style={styles.retryText}>Reintentar</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 180, backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { backgroundColor: colors.dangerSoft },
  title: { width: '100%', color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  description: { width: '100%', color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 430 },
  retry: { minHeight: 48, marginTop: spacing.sm, borderRadius: radius.pill, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  retryText: { color: colors.white, fontWeight: '800' }
});
