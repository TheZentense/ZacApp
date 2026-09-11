import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  return <View style={styles.page}><View style={styles.avatar}><Text style={styles.initials}>DC</Text></View><Text style={styles.name}>Demo Ciudadano</Text><Text style={styles.role}>Ciudadano</Text><View style={styles.card}><Text style={styles.label}>Correo</Text><Text>demo@zacapp.gt</Text><Text style={styles.label}>Municipio</Text><Text>Zacapa</Text></View><AppButton label="Cerrar sesión" variant="secondary" onPress={() => router.replace('/login')} /></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background, alignItems: 'center' }, avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, initials: { fontSize: 28, fontWeight: '800', color: colors.primary }, name: { fontSize: 24, fontWeight: '800', color: colors.primary }, role: { color: colors.muted }, card: { alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, marginVertical: spacing.md }, label: { color: colors.secondary, fontWeight: '700', marginTop: spacing.sm } });
